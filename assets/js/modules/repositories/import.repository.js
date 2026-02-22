async function importProjectDatasetAtomic(
  databaseService,
  data,
  existingProjectIdToDelete
) {
  const payload = {
    projects: Array.isArray(data?.projects) ? data.projects : [],
    vendors: Array.isArray(data?.vendors) ? data.vendors : [],
    contracts: Array.isArray(data?.contracts) ? data.contracts : [],
    cpcItems: Array.isArray(data?.cpcItems) ? data.cpcItems : [],
    cpcDetailRows: Array.isArray(data?.cpcDetailRows) ? data.cpcDetailRows : [],
    installments: Array.isArray(data?.installments) ? data.installments : [],
    bonds: Array.isArray(data?.bonds) ? data.bonds : [],
  };

  await databaseService.db.transaction("rw", databaseService.db.tables, async () => {
    if (existingProjectIdToDelete) {
      const contractIdsToDelete = await databaseService.db.contracts
        .where("projectId")
        .equals(existingProjectIdToDelete)
        .primaryKeys();

      if (contractIdsToDelete.length > 0) {
        const cpcIdsToDelete = (
          await databaseService.db.cpcItems
            .where("contractId")
            .anyOf(contractIdsToDelete)
            .toArray()
        ).map((cpc) => cpc.id);

        if (cpcIdsToDelete.length > 0) {
          await databaseService.db.installments.where("cpcId").anyOf(cpcIdsToDelete).delete();
          await databaseService.db.bonds.where("cpcId").anyOf(cpcIdsToDelete).delete();
        }

        await databaseService.db.bonds.where("contractId").anyOf(contractIdsToDelete).delete();
        await databaseService.db.cpcItems.where("contractId").anyOf(contractIdsToDelete).delete();
        await databaseService.db.cpcDetailRows
          .where("contractId")
          .anyOf(contractIdsToDelete)
          .delete();
      }

      await databaseService.db.contracts
        .where("projectId")
        .equals(existingProjectIdToDelete)
        .delete();
      await databaseService.db.projects.delete(existingProjectIdToDelete);
    }

    if (payload.projects.length > 0) {
      await databaseService.db.projects.bulkPut(payload.projects);
    }
    if (payload.vendors.length > 0) {
      await databaseService.db.vendors.bulkPut(payload.vendors);
    }
    if (payload.contracts.length > 0) {
      await databaseService.db.contracts.bulkPut(payload.contracts);
    }
    if (payload.cpcItems.length > 0) {
      await databaseService.db.cpcItems.bulkPut(payload.cpcItems);
    }
    if (payload.cpcDetailRows.length > 0) {
      await databaseService.db.cpcDetailRows.bulkPut(payload.cpcDetailRows);
    }
    if (payload.installments.length > 0) {
      await databaseService.db.installments.bulkPut(payload.installments);
    }
    if (payload.bonds.length > 0) {
      await databaseService.db.bonds.bulkPut(payload.bonds);
    }
  });
}

export { importProjectDatasetAtomic };
