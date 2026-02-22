async function deleteRecordsByTableIds(databaseService, idsByTable) {
  const tableEntries = Object.entries(idsByTable || {}).filter(
    ([, ids]) => Array.isArray(ids) && ids.length > 0
  );

  if (tableEntries.length === 0) {
    return { deletedTables: [] };
  }

  await databaseService.db.transaction("rw", databaseService.db.tables, async () => {
    for (const [tableName, ids] of tableEntries) {
      const table = databaseService.db[tableName];
      if (!table) continue;
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length > 0) {
        await table.bulkDelete(uniqueIds);
      }
    }
  });

  return { deletedTables: tableEntries.map(([tableName]) => tableName) };
}

async function getAppStateValue(databaseService, key) {
  return databaseService.db.appState.get(key);
}

async function clearAllTables(databaseService) {
  await Promise.all(databaseService.db.tables.map((table) => table.clear()));
}

export { deleteRecordsByTableIds, getAppStateValue, clearAllTables };
