function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function addDetailRowAndReorder(databaseService, newRow, contractRows) {
  const insertedRow = clone(newRow);
  const reorderedRows = clone(contractRows || []);

  const newId = await databaseService.db.cpcDetailRows.add(insertedRow);
  insertedRow.id = newId;

  const nextRows = reorderedRows.map((row) =>
    row.id === newRow.id ? { ...row, id: newId } : row
  );

  await databaseService.db.cpcDetailRows.bulkPut(nextRows);
  return { insertedRow, reorderedRows: nextRows };
}

async function saveDetailRow(databaseService, row) {
  const payload = clone(row);
  await databaseService.db.cpcDetailRows.put(payload);
  return payload;
}

async function saveDetailRows(databaseService, rows) {
  const payload = clone(rows || []);
  if (payload.length === 0) return [];
  await databaseService.db.cpcDetailRows.bulkPut(payload);
  return payload;
}

async function deleteDetailRowById(databaseService, rowId) {
  await databaseService.db.cpcDetailRows.delete(rowId);
  return { rowId };
}

async function addDetailRows(databaseService, rows) {
  const payload = clone(rows || []);
  if (payload.length === 0) return [];
  const ids = await databaseService.db.cpcDetailRows.bulkAdd(payload, { allKeys: true });
  payload.forEach((row, i) => {
    row.id = ids[i];
  });
  return payload;
}

async function deleteDetailRowsByIds(databaseService, rowIds) {
  const ids = Array.isArray(rowIds) ? rowIds : [];
  if (ids.length === 0) return { deletedIds: [] };
  await databaseService.db.cpcDetailRows.bulkDelete(ids);
  return { deletedIds: ids };
}

async function deleteDetailRowsByContract(databaseService, contractId) {
  await databaseService.db.cpcDetailRows.where("contractId").equals(contractId).delete();
}

export {
  addDetailRowAndReorder,
  saveDetailRow,
  saveDetailRows,
  deleteDetailRowById,
  addDetailRows,
  deleteDetailRowsByIds,
  deleteDetailRowsByContract,
};
