// Module extracted from n33.html: database service + shared utilities
import { APP_CONFIG } from "../../../config/app.config.js";
import { createSupabaseRealtimeService } from "./supabase-realtime.service.js";

const { Dexie } = window;
  const databaseService = {
    db: null,
    _supabaseSync: null,
    _isApplyingRemoteSync: false,
    _syncRefreshCallback: null,
    _syncRefreshTimer: null,
    _syncStatusCallback: null,

    initialize() {
      this.db = new Dexie("CPCVisionDB");

      this.db.version(1).stores({
        projects: "++id, &name",
        vendors: "++id, &vendorNo, name",
        contracts:
          "++id, &contractNo, projectId, vendorId, code, [projectId+vendorId]",
        cpcItems:
          "++id, cpcIdentifier, contractId, projectId, vendorId, code, receivedDate, paymentDueDate, [projectId+vendorId], [projectId+receivedDate]",
        installments:
          "++id, cpcId, contractId, projectId, vendorId, date, [projectId+date], [vendorId+date]",
        bonds:
          "++id, contractId, *cpcId, projectId, vendorId, expiryDate, bondNumber, isSettled, [isSettled+expiryDate], [projectId+expiryDate], [vendorId+expiryDate]",
        appState: "key",
        cpcDetailRows:
          "++id, id, contractId, cpcNo, invoicePostingDate, [contractId+invoicePostingDate]",
        banks: "++id, &name",
      });

      this.db
        .version(2)
        .stores({
          projects: "++id, &name",
          vendors: "++id, &vendorNo, name",
          contracts:
            "++id, &contractNo, projectId, vendorId, code, [projectId+vendorId]",
          cpcItems:
            "++id, cpcIdentifier, contractId, projectId, vendorId, code, receivedDate, paymentDueDate, projectName, vendorName, contractNo, [projectId+vendorId], [projectId+receivedDate], [vendorId+receivedDate]",
          installments:
            "++id, cpcId, contractId, projectId, vendorId, date, isSwap, [projectId+date], [vendorId+date], [contractId+date]",
          bonds:
            "++id, contractId, projectId, vendorId, expiryDate, bondNumber, isSettled, [isSettled+expiryDate], [projectId+expiryDate], [vendorId+expiryDate]",
          appState: "key",
          cpcDetailRows:
            "++id, id, contractId, cpcNo, invoicePostingDate, [contractId+invoicePostingDate]",
          banks: "++id, &name",
        })
        .upgrade(async (tx) => {
          console.log(
            "Upgrading database to version 2: Denormalizing data and preparing bonds table..."
          );

          await tx
            .table("bonds")
            .toCollection()
            .modify((bond) => {
              if (Array.isArray(bond.cpcId) && bond.cpcId.length > 0) {
                bond.cpcId = bond.cpcId[0];
              } else if (Array.isArray(bond.cpcId)) {
                delete bond.cpcId;
              }
            });

          const projects = await tx.table("projects").toArray();
          const vendors = await tx.table("vendors").toArray();
          const contracts = await tx.table("contracts").toArray();
          const projectMap = new Map(projects.map((p) => [p.id, p]));
          const vendorMap = new Map(vendors.map((v) => [v.id, v]));
          const contractMap = new Map(contracts.map((c) => [c.id, c]));
          await tx
            .table("cpcItems")
            .toCollection()
            .modify((cpc) => {
              const contract = contractMap.get(cpc.contractId);
              if (contract) {
                const project = projectMap.get(contract.projectId);
                const vendor = vendorMap.get(contract.vendorId);
                cpc.contractNo = contract.contractNo;
                if (project) cpc.projectName = project.name;
                if (vendor) cpc.vendorName = vendor.name;
              }
            });
          await tx
            .table("installments")
            .toCollection()
            .modify((inst) => {
              const contract = contractMap.get(inst.contractId);
              if (contract) {
                inst.projectId = contract.projectId;
                inst.vendorId = contract.vendorId;
              }
            });
          await tx
            .table("bonds")
            .toCollection()
            .modify((bond) => {
              const contract = contractMap.get(bond.contractId);
              if (contract) {
                bond.projectId = contract.projectId;
                bond.vendorId = contract.vendorId;
              }
            });
        });

      this.db.version(3).stores({
        projects: "++id, &name",
        vendors: "++id, &vendorNo, name",
        contracts:
          "++id, &contractNo, projectId, vendorId, code, [projectId+vendorId]",
        cpcItems:
          "++id, cpcIdentifier, contractId, projectId, vendorId, code, receivedDate, paymentDueDate, projectName, vendorName, contractNo, [projectId+vendorId], [projectId+receivedDate], [vendorId+receivedDate]",
        installments:
          "++id, cpcId, contractId, projectId, vendorId, date, isSwap, [projectId+date], [vendorId+date], [contractId+date]",
        bonds:
          "++id, contractId, cpcId, projectId, vendorId, expiryDate, bondNumber, isSettled, [isSettled+expiryDate], [projectId+expiryDate], [vendorId+expiryDate]",
        appState: "key",
        cpcDetailRows:
          "++id, id, contractId, cpcNo, invoicePostingDate, [contractId+invoicePostingDate]",
        banks: "++id, &name",
      });

      this.db
        .version(4)
        .stores({
          projects: "++id, &name",
          vendors: "++id, &vendorNo, name",
          contracts:
            "++id, &contractNo, projectId, vendorId, code, [projectId+vendorId]",
          cpcItems:
            "++id, cpcIdentifier, contractId, projectId, vendorId, code, receivedDate, paymentDueDate, [projectId+vendorId], [projectId+receivedDate], [vendorId+receivedDate]",
          installments:
            "++id, cpcId, contractId, projectId, vendorId, date, isSwap, [projectId+date], [vendorId+date], [contractId+date]",
          bonds:
            "++id, contractId, cpcId, projectId, vendorId, expiryDate, bondNumber, isSettled, [isSettled+expiryDate], [projectId+expiryDate], [vendorId+expiryDate]",
          appState: "key",
          cpcDetailRows:
            "++id, id, contractId, cpcNo, invoicePostingDate, [contractId+invoicePostingDate]",
          banks: "++id, &name",
        })
        .upgrade(async (tx) => {
          console.log(
            "Upgrading database to version 4: Normalizing schema by removing denormalized fields."
          );

          await tx
            .table("cpcItems")
            .toCollection()
            .modify((cpc) => {
              delete cpc.projectName;
              delete cpc.vendorName;
              delete cpc.vendorNameAbbr;
              delete cpc.vendorNo;
              delete cpc.contractNo;
            });

          console.log("Schema for 'cpcItems' has been normalized.");
        });

      this.db.version(5).stores({
        projects: "++id, &name",
        vendors: "++id, &vendorNo, name",
        contracts:
          "++id, &contractNo, projectId, vendorId, code, [projectId+vendorId]",
        cpcItems:
          "++id, cpcIdentifier, contractId, projectId, vendorId, code, receivedDate, paymentDueDate, [projectId+vendorId], [projectId+receivedDate], [vendorId+receivedDate]",
        installments:
          "++id, cpcId, contractId, projectId, vendorId, date, isSwap, [projectId+date], [vendorId+date], [contractId+date]",
        bonds:
          "++id, contractId, cpcId, projectId, vendorId, expiryDate, bondNumber, isSettled, [isSettled+expiryDate], [projectId+expiryDate], [vendorId+expiryDate]",
        appState: "key",
        cpcDetailRows:
          "++id, id, contractId, cpcNo, invoicePostingDate, [contractId+invoicePostingDate]",
        banks: "++id, &name",

        categories: "++id, &code, parentCode",
      });

      this.db.version(6).stores({
        projects: "++id, &name",
        vendors: "++id, &vendorNo, name",
        contracts: "++id, &contractNo, projectId, vendorId, code, [projectId+vendorId]",
        cpcItems: "++id, cpcIdentifier, contractId, projectId, vendorId, code, receivedDate, paymentDueDate, [projectId+vendorId], [projectId+receivedDate], [vendorId+receivedDate]",
        installments: "++id, cpcId, contractId, projectId, vendorId, date, isSwap, [projectId+date], [vendorId+date], [contractId+date]",
        bonds: "++id, contractId, cpcId, projectId, vendorId, expiryDate, bondNumber, isSettled, [isSettled+expiryDate], [projectId+expiryDate], [vendorId+expiryDate]",
        appState: "key",
        cpcDetailRows: "++id, id, contractId, cpcNo, invoicePostingDate, [contractId+invoicePostingDate]",
        banks: "++id, &name",
        categories: "++id, &code, parentCode",
      });
      this._installLocalChangeHooks();
    },

    _getSyncTables() {
      return Array.isArray(APP_CONFIG?.supabase?.tables)
        ? APP_CONFIG.supabase.tables
        : [];
    },

    _getPrimaryKeyForTable(tableName) {
      const map = APP_CONFIG?.supabase?.primaryKeyMap || {};
      return map[tableName] || "id";
    },

    _generateClientNumericId() {
      return Date.now() * 1000 + Math.floor(Math.random() * 1000);
    },

    _queueRemoteUpsert(tableName, row) {
      if (!this._supabaseSync || this._isApplyingRemoteSync) return;
      this._supabaseSync.queueUpsert(tableName, row);
    },

    _queueRemoteDelete(tableName, primaryKeyValue) {
      if (!this._supabaseSync || this._isApplyingRemoteSync) return;
      this._supabaseSync.queueDelete(tableName, primaryKeyValue);
    },

    _installLocalChangeHooks() {
      if (!this.db) return;
      const syncTables = new Set(this._getSyncTables());
      this.db.tables.forEach((table) => {
        if (!syncTables.has(table.name)) return;
        if (table.__x3SyncHooksInstalled) return;

        table.hook("creating", (primKey, obj) => {
          if (this._isApplyingRemoteSync) return;
          const primaryKey = this._getPrimaryKeyForTable(table.name);
          const row = { ...(obj || {}) };
          let effectiveKey = row[primaryKey];
          if (effectiveKey === undefined || effectiveKey === null) {
            effectiveKey = primKey;
          }
          if (
            (effectiveKey === undefined || effectiveKey === null) &&
            primaryKey === "id"
          ) {
            effectiveKey = this._generateClientNumericId();
            row[primaryKey] = effectiveKey;
          }
          if (effectiveKey !== undefined && effectiveKey !== null) {
            row[primaryKey] = effectiveKey;
          }
          this._queueRemoteUpsert(table.name, row);
          if (
            (primKey === undefined || primKey === null) &&
            primaryKey === "id" &&
            effectiveKey !== undefined &&
            effectiveKey !== null
          ) {
            return effectiveKey;
          }
        });

        table.hook("updating", (mods, primKey, obj) => {
          if (this._isApplyingRemoteSync) return;
          const primaryKey = this._getPrimaryKeyForTable(table.name);
          const row = {
            ...(obj || {}),
            ...(mods || {}),
          };
          if (row[primaryKey] === undefined || row[primaryKey] === null) {
            row[primaryKey] = primKey;
          }
          this._queueRemoteUpsert(table.name, row);
        });

        table.hook("deleting", (primKey) => {
          if (this._isApplyingRemoteSync) return;
          this._queueRemoteDelete(table.name, primKey);
        });

        table.__x3SyncHooksInstalled = true;
      });
    },

    _scheduleRealtimeRefresh(meta = {}) {
      if (typeof this._syncRefreshCallback !== "function") return;
      if (this._syncRefreshTimer) {
        clearTimeout(this._syncRefreshTimer);
      }
      this._syncRefreshTimer = setTimeout(() => {
        this._syncRefreshTimer = null;
        Promise.resolve(this._syncRefreshCallback(meta)).catch((error) => {
          console.error("[SupabaseSync] refresh callback failed:", error);
        });
      }, 180);
    },

    _notifySyncStatus(statusPayload = {}) {
      if (typeof this._syncStatusCallback !== "function") return;
      try {
        this._syncStatusCallback({
          ...statusPayload,
          at: statusPayload.at || new Date().toISOString(),
        });
      } catch (error) {
        console.error("[SupabaseSync] status callback failed:", error);
      }
    },

    async applyRemoteSnapshot(snapshot) {
      const incoming = snapshot && typeof snapshot === "object" ? snapshot : {};
      const syncTables = this._getSyncTables();
      if (syncTables.length === 0) return;

      this._isApplyingRemoteSync = true;
      try {
        await this.db.transaction("rw", this.db.tables, async () => {
          for (const tableName of syncTables) {
            const table = this.db[tableName];
            if (!table) continue;
            await table.clear();
            const rows = Array.isArray(incoming[tableName]) ? incoming[tableName] : [];
            if (rows.length > 0) {
              await table.bulkPut(rows);
            }
          }
        });
      } finally {
        this._isApplyingRemoteSync = false;
      }
    },

    async applyRemoteMutation(payload) {
      if (!payload || !payload.table) return;
      const tableName = payload.table;
      const table = this.db?.[tableName];
      if (!table) return;

      const eventType = (payload.eventType || "").toUpperCase();
      const primaryKey = this._getPrimaryKeyForTable(tableName);
      this._isApplyingRemoteSync = true;
      try {
        if (eventType === "DELETE") {
          const keyValue = payload.old?.[primaryKey];
          if (keyValue !== undefined && keyValue !== null) {
            await table.delete(keyValue);
          }
          return;
        }
        const row = payload.new;
        if (!row) return;
        await table.put(row);
      } finally {
        this._isApplyingRemoteSync = false;
      }
    },

    async startSupabaseSync(onRefresh, onStatus) {
      if (!this.db) this.initialize();
      this._syncRefreshCallback = typeof onRefresh === "function" ? onRefresh : null;
      this._syncStatusCallback = typeof onStatus === "function" ? onStatus : null;

      this._supabaseSync = createSupabaseRealtimeService(APP_CONFIG?.supabase || {});
      if (!this._supabaseSync.canStart()) {
        this._notifySyncStatus({
          connected: false,
          status: "DISABLED_OR_MISSING_CONFIG",
          reason: "disabled-or-missing-config",
          stage: "start",
        });
        return { enabled: false, reason: "disabled-or-missing-config" };
      }

      const result = await this._supabaseSync.start(
        async (payload) => {
          await this.applyRemoteMutation(payload);
          this._notifySyncStatus({
            connected: true,
            status: "REMOTE_EVENT",
            stage: "realtime",
            table: payload?.table || "",
            eventType: payload?.eventType || "",
          });
          this._scheduleRealtimeRefresh({
            type: "mutation",
            table: payload?.table || "",
            eventType: payload?.eventType || "",
          });
        },
        (statusPayload) => this._notifySyncStatus(statusPayload)
      );

      if (!result.enabled) {
        this._notifySyncStatus({
          connected: false,
          status: "START_FAILED",
          reason: result.reason || "start-failed",
          stage: "start",
        });
        return result;
      }

      if (result.snapshot) {
        await this.applyRemoteSnapshot(result.snapshot);
        this._scheduleRealtimeRefresh({ type: "snapshot" });
      }
      this._notifySyncStatus({
        connected: true,
        status: "SYNC_READY",
        stage: "start",
      });
      return { enabled: true };
    },

    async getAllData() {
      if (!this.db) this.initialize();
      const data = {};
      await this.db.transaction("r", this.db.tables, async () => {
        for (const table of this.db.tables) {
          const tableName = table.name;
          if (!tableName.startsWith("_")) {
            data[tableName] = await table.toArray();
          }
        }
      });
      return data;
    },

    async saveAllData(appData) {
      if (!this.db) this.initialize();

      const sanitizedData = JSON.parse(JSON.stringify(appData));

      const tables = [
        "projects",
        "vendors",
        "banks",
        "contracts",
        "cpcItems",
        "installments",
        "bonds",
        "cpcDetailRows",
        "categories",
      ];

      return this.db.transaction("rw", this.db.tables, async () => {
        for (const tableName of tables) {
          if (this.db[tableName]) {
            await this.db[tableName].clear();

            const rows = sanitizedData[tableName];
            if (rows && Array.isArray(rows) && rows.length > 0) {
              await this.db[tableName].bulkAdd(rows);
            }
          }
        }
      });
    },

    async upsertBatch(tableName, rows) {
      if (!this.db) this.initialize();
      if (!this.db[tableName]) {
        throw new Error(`Table not found: ${tableName}`);
      }
      if (!Array.isArray(rows) || rows.length === 0) return [];

      const savedRows = [];
      await this.db.transaction("rw", this.db[tableName], async () => {
        for (const row of rows) {
          const payload = JSON.parse(JSON.stringify(row));
          if (payload.id !== null && payload.id !== undefined) {
            await this.db[tableName].put(payload);
            savedRows.push(payload);
          } else {
            const newId = await this.db[tableName].add(payload);
            savedRows.push({ ...payload, id: newId });
          }
        }
      });

      return savedRows;
    },

    async saveTables(tablesData) {
      if (!tablesData || typeof tablesData !== "object") return {};
      const result = {};
      for (const [tableName, rows] of Object.entries(tablesData)) {
        result[tableName] = await this.upsertBatch(tableName, rows || []);
      }
      return result;
    },

    async updateVendor(vendorData) {
      return this.db.vendors.put(vendorData);
    },

    async updateProject(projectData) {
      return this.db.projects.put(projectData);
    },

    async updateContract(contractData) {
      return this.db.transaction(
        "rw",
        this.db.contracts,
        this.db.cpcItems,
        this.db.installments,
        this.db.bonds,
        async () => {
          await this.db.contracts.put(contractData);

          const childModifications = {
            projectId: contractData.projectId,
            vendorId: contractData.vendorId,
          };

          await this.db.cpcItems
            .where("contractId")
            .equals(contractData.id)
            .modify(childModifications);

          await this.db.installments
            .where("contractId")
            .equals(contractData.id)
            .modify(childModifications);

          await this.db.bonds
            .where("contractId")
            .equals(contractData.id)
            .modify(childModifications);
        }
      );
    },

    async findOrCreateEntity(tableName, propertyName, value) {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        throw new Error(`GiÃ¡ trá»‹ cho ${propertyName} khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.`);
      }
      let entity = await this.db[tableName]
        .where(propertyName)
        .equalsIgnoreCase(trimmedValue)
        .first();
      if (!entity) {
        const newEntity = { [propertyName]: trimmedValue };
        if (tableName === "vendors" && propertyName === "vendorNo") {
          newEntity.name = "ChÆ°a cÃ³ tÃªn";
        }
        const newId = await this.db[tableName].add(newEntity);
        entity = { id: newId, ...newEntity };
      }
      return entity;
    },

    async resyncAllDenormalizedData() {
      console.group("=== Báº®T Äáº¦U KIá»‚M TRA & Sá»¬A CHá»®A Dá»® LIá»†U ===");
      return this.db.transaction("rw", this.db.tables, async () => {
        const allContracts = await this.db.contracts.toArray();
        const contractMap = new Map(allContracts.map((c) => [c.id, c]));

        let updatedCount = 0;

        await this.db
          .table("cpcItems")
          .toCollection()
          .modify((cpc) => {
            const contract = contractMap.get(cpc.contractId);
            let changed = false;
            if (contract) {
              if (cpc.projectId !== contract.projectId) {
                console.log(
                  `%c[Sá»­a CPC] ID: ${cpc.id} (CPC: ${cpc.cpcIdentifier}) - Sá»­a ProjectID tá»« ${cpc.projectId} -> ${contract.projectId}`,
                  "color: orange"
                );
                cpc.projectId = contract.projectId;
                changed = true;
              }
              if (cpc.vendorId !== contract.vendorId) {
                console.log(
                  `%c[Sá»­a CPC] ID: ${cpc.id} (CPC: ${cpc.cpcIdentifier}) - Sá»­a VendorID tá»« ${cpc.vendorId} -> ${contract.vendorId}`,
                  "color: orange"
                );
                cpc.vendorId = contract.vendorId;
                changed = true;
              }
            }
            if (changed) updatedCount++;
          });

        const updateChildren = async (tableName) => {
          await this.db
            .table(tableName)
            .toCollection()
            .modify((child) => {
              const contract = contractMap.get(child.contractId);
              if (contract) {
                let childChanged = false;

                if (child.projectId !== contract.projectId) {
                  console.log(
                    `%c[Sá»­a ${tableName}] ID: ${child.id} - Sá»­a ProjectID tá»« ${child.projectId} -> ${contract.projectId}`,
                    "color: #bada55"
                  );
                  child.projectId = contract.projectId;
                  childChanged = true;
                }

                if (child.vendorId !== contract.vendorId) {
                  console.log(
                    `%c[Sá»­a ${tableName}] ID: ${child.id} - Sá»­a VendorID tá»« ${child.vendorId} -> ${contract.vendorId}`,
                    "color: #bada55"
                  );
                  child.vendorId = contract.vendorId;
                  childChanged = true;
                }

                if (childChanged) updatedCount++;
              }
            });
        };

        await updateChildren("installments");
        await updateChildren("bonds");

        console.log(
          `%c=== HOÃ€N Táº¤T === Tá»•ng sá»‘ báº£n ghi Ä‘Ã£ sá»­a: ${updatedCount}`,
          "font-weight: bold; font-size: 14px; color: green"
        );
        console.groupEnd();
        return updatedCount;
      });
    },
  };

  databaseService.initialize();
  const appUtils = {
    format: {
      currency(value, currency = "VND", lang = "vi-VN") {
        if (value === null || value === undefined) return "";
        const options = {
          style: "currency",
          currency: currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        };
        if (currency === "USD") {
          options.minimumFractionDigits = 2;
          options.maximumFractionDigits = 2;
          lang = "en-US";
        }
        return new Intl.NumberFormat(lang, options).format(value || 0);
      },

      usdInput(value) {
        if (value === null || value === undefined) return "0.00";
        return new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true,
        }).format(value || 0);
      },

      number(value, lang = "vi-VN") {
        if (value === 0) return "0";
        if (!value) return "";
        return new Intl.NumberFormat(lang).format(value);
      },

      reportNumber(value, lang = "vi-VN") {
        if (value === 0) return "-";
        if (!value) return "";
        return new Intl.NumberFormat(lang).format(value);
      },

      date(dateInput) {
        if (!dateInput) return "";
        const d = new Date(dateInput);

        if (isNaN(d.getTime())) {
          console.warn(
            "Robustness check: Invalid date input provided to format.date:",
            dateInput
          );
          return "";
        }
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const day = d.getDate().toString().padStart(2, "0");

        return `${year}-${month}-${day}`;
      },
    },

    ui: {
      toggleModal(modalId, action = "show") {
        const modalEl = document.getElementById(modalId);
        if (modalEl) {
          const modalInstance =
            bootstrap.Modal.getInstance(modalEl) ||
            new bootstrap.Modal(modalEl);

          if (action === "show") {
            modalInstance.show();
          } else if (action === "hide") {
            if (
              document.activeElement &&
              modalEl.contains(document.activeElement)
            ) {
              document.activeElement.blur();
            }
            modalInstance.hide();
          }
        }
      },

      showConfirmation(vueInstance, config) {
        vueInstance.confirmation = {
          title: vueInstance.t("confirm"),
          message: vueInstance.t("areYouSure"),
          onConfirm: null,
          onCancel: null,
          confirmButtonText: vueInstance.t("confirm"),
          confirmButtonClass: "btn-danger",
          ...config,
        };
        this.toggleModal("confirmationModal", "show");
      },
    },

    text: {
      normalizeVietnamese(str) {
        if (!str) return "";
        return str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/Ä‘/g, "d")
          .replace(/Ä/g, "D")
          .toLowerCase();
      },

      parseVndAmount(str) {
        if (typeof str !== "string" && typeof str !== "number") return 0;
        const cleanStr = String(str).replace(/\./g, "").replace(/,/g, "");
        return parseInt(cleanStr, 10) || 0;
      },

      parseUsdAmount(str) {
        if (typeof str !== "string" && typeof str !== "number") return 0;
        let sanitized = String(str).replace(/[^0-9.]/g, "");
        const parts = sanitized.split(".");
        if (parts.length > 2) {
          sanitized = parts[0] + "." + parts.slice(1).join("");
        }
        return parseFloat(sanitized) || 0;
      },
    },

    filter: {
      getAvailableItems({
        sourceData,
        linkingData,
        linkKey,
        idKey = "id",
        nameKey = "name",
        searchTerm = "",
        vueInstance,
      }) {
        if (!Array.isArray(sourceData) || !Array.isArray(linkingData)) {
          console.warn(
            "Robustness check: sourceData or linkingData is not an array in getAvailableItems."
          );
          return [];
        }

        const idsInUse = new Set(
          linkingData
            .filter(
              (item) =>
                item &&
                item[linkKey] !== undefined &&
                item[linkKey] !== null
            )
            .map((item) => item[linkKey])
        );

        const activeItems = sourceData.filter(
          (item) => item && idsInUse.has(item[idKey])
        );

        if (!searchTerm) {
          return activeItems.sort((a, b) =>
            (a[nameKey] || "").localeCompare(b[nameKey] || "")
          );
        }

        const normalizedSearch =
          appUtils.text.normalizeVietnamese(searchTerm);
        return activeItems
          .filter(
            (item) =>
              item &&
              item[nameKey] &&
              appUtils.text
                .normalizeVietnamese(item[nameKey])
                .includes(normalizedSearch)
          )
          .sort((a, b) =>
            (a[nameKey] || "").localeCompare(b[nameKey] || "")
          );
      },

      filterBySelectedIds(data, selectedIds, key) {
        if (!selectedIds || selectedIds.length === 0) return data;
        return data.filter((item) => selectedIds.includes(item[key]));
      },
    },
    validation: {
      isValidDateString(dateString) {
        if (!dateString || typeof dateString !== "string") return false;
        const d = new Date(dateString);
        if (isNaN(d.getTime())) {
          return false;
        }
        const year = d.getFullYear();
        return year >= 2010 && year <= 2040;
      },
    },
  };

export { databaseService, appUtils };
