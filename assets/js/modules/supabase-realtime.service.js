function sanitizeRow(row) {
  const clean = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    if (value !== undefined) clean[key] = value;
  });
  return clean;
}

function createSupabaseRealtimeService(config) {
  const cfg = config || {};
  const enabled = Boolean(cfg.enabled);
  const url = (cfg.url || "").trim();
  const anonKey = (cfg.anonKey || "").trim();
  const schema = (cfg.schema || "public").trim();
  const tables = Array.isArray(cfg.tables) ? cfg.tables : [];
  const primaryKeyMap = cfg.primaryKeyMap || {};
  const tableNameMap = cfg.tableNameMap || {};
  const channelName = (cfg.channelName || "x3-realtime").trim();
  const storageMode = (cfg.storageMode || "envelope").trim().toLowerCase();
  const isEnvelopeMode = storageMode !== "raw";

  let client = null;
  let channel = null;
  let remoteListener = null;
  let statusListener = null;
  let writeQueue = Promise.resolve();

  function canStart() {
    return enabled && Boolean(url) && Boolean(anonKey);
  }

  function getPrimaryKey(tableName) {
    return primaryKeyMap[tableName] || "id";
  }

  function getRemoteTableName(tableName) {
    return tableNameMap[tableName] || tableName;
  }

  function emitStatus(statusPayload) {
    if (typeof statusListener !== "function") return;
    statusListener({
      ...statusPayload,
      at: new Date().toISOString(),
    });
  }

  function toEnvelopeRow(tableName, payload) {
    const primaryKey = getPrimaryKey(tableName);
    const keyValue = payload?.[primaryKey];
    if (keyValue === undefined || keyValue === null) return null;
    return {
      row_key: String(keyValue),
      payload,
      updated_at: new Date().toISOString(),
    };
  }

  function fromEnvelopeRow(tableName, row) {
    if (!row || typeof row !== "object") return null;
    const payload = sanitizeRow(row.payload || {});
    const primaryKey = getPrimaryKey(tableName);
    if (payload[primaryKey] === undefined || payload[primaryKey] === null) {
      const maybeNumber = Number(row.row_key);
      payload[primaryKey] = Number.isNaN(maybeNumber) ? row.row_key : maybeNumber;
    }
    return payload;
  }

  function normalizeRealtimePayload(tableName, payload) {
    if (!isEnvelopeMode) return payload;
    return {
      ...payload,
      table: tableName,
      new: fromEnvelopeRow(tableName, payload?.new),
      old: fromEnvelopeRow(tableName, payload?.old),
    };
  }

  function enqueueWrite(task) {
    writeQueue = writeQueue
      .then(task)
      .catch((error) => {
        console.error("[SupabaseSync] write failed:", error);
      });
    return writeQueue;
  }

  async function queueUpsert(tableName, row) {
    if (!client || !canStart()) return;
    const remoteTableName = getRemoteTableName(tableName);
    const payload = sanitizeRow(row);
    const primaryKey = getPrimaryKey(tableName);
    if (payload[primaryKey] === undefined || payload[primaryKey] === null) {
      return;
    }
    return enqueueWrite(async () => {
      const upsertRows = isEnvelopeMode
        ? [toEnvelopeRow(tableName, payload)].filter(Boolean)
        : [payload];
      if (upsertRows.length === 0) return;
      const { error } = await client
        .from(remoteTableName)
        .upsert(upsertRows, {
          onConflict: isEnvelopeMode ? "row_key" : primaryKey,
        });
      if (error) {
        emitStatus({
          stage: "write",
          connected: false,
          status: "WRITE_ERROR",
          reason: error.message || "upsert-failed",
          table: tableName,
        });
        throw new Error(
          `upsert ${tableName} failed: ${error.message || "unknown"}`
        );
      }
      emitStatus({
        stage: "write",
        connected: true,
        status: "WRITE_OK",
        table: tableName,
      });
    });
  }

  async function queueDelete(tableName, primaryKeyValue) {
    if (!client || !canStart()) return;
    const remoteTableName = getRemoteTableName(tableName);
    const primaryKey = getPrimaryKey(tableName);
    if (primaryKeyValue === undefined || primaryKeyValue === null) return;
    return enqueueWrite(async () => {
      const query = client.from(remoteTableName).delete();
      const { error } = isEnvelopeMode
        ? await query.eq("row_key", String(primaryKeyValue))
        : await query.eq(primaryKey, primaryKeyValue);
      if (error) {
        emitStatus({
          stage: "write",
          connected: false,
          status: "WRITE_ERROR",
          reason: error.message || "delete-failed",
          table: tableName,
        });
        throw new Error(
          `delete ${tableName} failed: ${error.message || "unknown"}`
        );
      }
      emitStatus({
        stage: "write",
        connected: true,
        status: "WRITE_OK",
        table: tableName,
      });
    });
  }

  async function pullInitialSnapshot() {
    const snapshot = {};
    for (const tableName of tables) {
      const remoteTableName = getRemoteTableName(tableName);
      const selectClause = isEnvelopeMode ? "row_key,payload" : "*";
      const { data, error } = await client
        .from(remoteTableName)
        .select(selectClause);
      if (error) {
        console.error(
          `[SupabaseSync] snapshot failed for ${tableName}:`,
          error.message
        );
        snapshot[tableName] = [];
        emitStatus({
          stage: "snapshot",
          connected: false,
          status: "SNAPSHOT_ERROR",
          reason: error.message || "snapshot-failed",
          table: tableName,
        });
        continue;
      }
      const rows = Array.isArray(data) ? data : [];
      snapshot[tableName] = isEnvelopeMode
        ? rows.map((item) => fromEnvelopeRow(tableName, item)).filter(Boolean)
        : rows;
    }
    emitStatus({
      stage: "snapshot",
      connected: true,
      status: "SNAPSHOT_OK",
    });
    return snapshot;
  }

  function subscribeRealtime() {
    channel = client.channel(channelName);
    tables.forEach((tableName) => {
      const remoteTableName = getRemoteTableName(tableName);
      channel.on(
        "postgres_changes",
        { event: "*", schema, table: remoteTableName },
        (payload) => {
          if (typeof remoteListener === "function") {
            remoteListener(normalizeRealtimePayload(tableName, payload));
          }
        }
      );
    });
    channel.subscribe((status) => {
      console.log(`[SupabaseSync] realtime status: ${status}`);
      const normalized = String(status || "").toUpperCase();
      const isConnected = normalized === "SUBSCRIBED";
      emitStatus({
        stage: "realtime",
        connected: isConnected,
        status: normalized || "UNKNOWN",
        reason: isConnected ? "" : "realtime-not-subscribed",
      });
    });
  }

  async function start(onRemoteEvent, onStatusChange) {
    statusListener = onStatusChange;
    if (!canStart()) {
      emitStatus({
        stage: "start",
        connected: false,
        status: "MISSING_CONFIG",
        reason: "missing-config",
      });
      return { enabled: false, reason: "missing-config" };
    }
    if (!window.supabase?.createClient) {
      emitStatus({
        stage: "start",
        connected: false,
        status: "SDK_MISSING",
        reason: "sdk-missing",
      });
      return { enabled: false, reason: "sdk-missing" };
    }

    client = window.supabase.createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    remoteListener = onRemoteEvent;
    emitStatus({
      stage: "start",
      connected: true,
      status: "CLIENT_READY",
    });
    const snapshot = await pullInitialSnapshot();
    subscribeRealtime();
    return { enabled: true, snapshot };
  }

  async function stop() {
    if (client && channel) {
      await client.removeChannel(channel);
    }
    channel = null;
    remoteListener = null;
    statusListener = null;
  }

  return {
    canStart,
    getPrimaryKey,
    queueUpsert,
    queueDelete,
    start,
    stop,
  };
}

export { createSupabaseRealtimeService };
