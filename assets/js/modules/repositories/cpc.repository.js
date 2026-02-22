function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function saveCpcWithRelations(databaseService, cpcInput, modalMode) {
  const cpcDataToProcess = clone(cpcInput);
  let createdContract = false;

  await databaseService.db.transaction(
    "rw",
    databaseService.db.tables,
    async () => {
      const projectEntity = await databaseService.findOrCreateEntity(
        "projects",
        "name",
        (cpcDataToProcess.projectName || "").trim()
      );
      const vendorEntity = await databaseService.findOrCreateEntity(
        "vendors",
        "vendorNo",
        (cpcDataToProcess.vendorNo || "").trim()
      );

      const contractNoTrimmed = (cpcDataToProcess.contractNo || "").trim();
      let masterContract = null;
      if (contractNoTrimmed) {
        masterContract = await databaseService.db.contracts
          .where("contractNo")
          .equalsIgnoreCase(contractNoTrimmed)
          .first();
      }

      if (!masterContract && contractNoTrimmed) {
        const newContract = {
          contractNo: contractNoTrimmed,
          projectId: projectEntity.id,
          vendorId: vendorEntity.id,
          date: cpcDataToProcess.receivedDate || new Date().toISOString().slice(0, 10),
          description: cpcDataToProcess.contents,
          code: cpcDataToProcess.code,
          currency: cpcDataToProcess.isUsd ? "USD" : "VND",
          settings: {
            repaymentThreshold: 80,
            retentionRate: 5,
            defaultVatRate: 8,
          },
        };
        const newId = await databaseService.db.contracts.add(newContract);
        masterContract = { ...newContract, id: newId };
        createdContract = true;
      }

      cpcDataToProcess.projectId = projectEntity.id;
      cpcDataToProcess.vendorId = vendorEntity.id;
      cpcDataToProcess.contractId = masterContract ? masterContract.id : null;

      const installmentsData = cpcDataToProcess.installments || [];
      const bondsData = cpcDataToProcess.bonds || [];
      delete cpcDataToProcess.installments;
      delete cpcDataToProcess.bonds;

      if (modalMode === "add" || modalMode === "copy") {
        delete cpcDataToProcess.id;
        const newId = await databaseService.db.cpcItems.add(cpcDataToProcess);
        cpcDataToProcess.id = newId;
      } else {
        await databaseService.db.cpcItems.put(cpcDataToProcess);
      }

      const cpcId = cpcDataToProcess.id;

      await databaseService.db.installments.where("cpcId").equals(cpcId).delete();

      if (installmentsData.length > 0) {
        const installmentsToSave = installmentsData.map((inst) => ({
          ...inst,
          cpcId,
          contractId: masterContract?.id,
          projectId: projectEntity.id,
          vendorId: vendorEntity.id,
        }));
        await databaseService.db.installments.bulkPut(installmentsToSave);
      }

      if (bondsData.length > 0) {
        const bondsToSave = bondsData.map((bond) => ({
          ...bond,
          cpcId,
          contractId: masterContract?.id,
          projectId: projectEntity.id,
          vendorId: vendorEntity.id,
        }));
        await databaseService.db.bonds.bulkPut(bondsToSave);
      }
    }
  );

  return { cpcDataToProcess, createdContract };
}

async function deleteCpcCascade(databaseService, cpcItem, installmentsByCpcId, bonds) {
  const installmentsForCpc = installmentsByCpcId.get(cpcItem.id) || [];
  const installmentIdsToDelete = installmentsForCpc.map((i) => i.id);
  const bondsToDelete = bonds.filter((b) => b.cpcId === cpcItem.id);
  const bondIdsToDelete = bondsToDelete.map((b) => b.id);

  await databaseService.db.transaction(
    "rw",
    databaseService.db.cpcItems,
    databaseService.db.installments,
    databaseService.db.bonds,
    async () => {
      if (installmentIdsToDelete.length > 0) {
        await databaseService.db.installments.bulkDelete(installmentIdsToDelete);
      }
      if (bondIdsToDelete.length > 0) {
        await databaseService.db.bonds.bulkDelete(bondIdsToDelete);
      }
      await databaseService.db.cpcItems.delete(cpcItem.id);
    }
  );

  return {
    cpcId: cpcItem.id,
    installmentIdsToDelete,
    bondIdsToDelete,
  };
}

async function upsertCpcsAndSyncDetailLinks(
  databaseService,
  cpcsToUpdate,
  cpcsToAdd,
  allUpdatedDetailRows
) {
  const cpcsToUpdatePayload = clone(cpcsToUpdate || []);
  const cpcsToAddPayload = clone(cpcsToAdd || []);
  const detailRowsPayload = clone(allUpdatedDetailRows || []);

  await databaseService.db.transaction(
    "rw",
    databaseService.db.cpcItems,
    databaseService.db.cpcDetailRows,
    async () => {
      if (cpcsToUpdatePayload.length > 0) {
        await databaseService.db.cpcItems.bulkPut(cpcsToUpdatePayload);
      }

      if (cpcsToAddPayload.length > 0) {
        const newIds = await databaseService.db.cpcItems.bulkAdd(cpcsToAddPayload, {
          allKeys: true,
        });
        cpcsToAddPayload.forEach((cpc, index) => {
          cpc.id = newIds[index];
          detailRowsPayload
            .filter((row) => row.cpcNo === cpc.cpcIdentifier)
            .forEach((row) => {
              row.linkedCpcId = cpc.id;
            });
        });
      }

      if (detailRowsPayload.length > 0) {
        await databaseService.db.cpcDetailRows.bulkPut(detailRowsPayload);
      }
    }
  );

  return {
    cpcsToUpdate: cpcsToUpdatePayload,
    cpcsToAdd: cpcsToAddPayload,
    allUpdatedDetailRows: detailRowsPayload,
  };
}

async function putCpcItem(databaseService, cpcItem) {
  const payload = clone(cpcItem);
  await databaseService.db.cpcItems.put(payload);
  return payload;
}

async function addCpcItem(databaseService, cpcItem) {
  const payload = clone(cpcItem);
  delete payload.id;
  const id = await databaseService.db.cpcItems.add(payload);
  return { ...payload, id };
}

async function updateCpcItemFields(databaseService, cpcId, cpcFields) {
  const payload = clone(cpcFields);
  await databaseService.db.cpcItems.update(cpcId, payload);
}

async function replaceInstallmentsForCpc(databaseService, cpcId, installments) {
  await databaseService.db.installments.where("cpcId").equals(cpcId).delete();
  const payload = clone(installments || []);
  if (payload.length > 0) {
    await databaseService.db.installments.bulkAdd(payload);
  }
}

async function getAllInstallments(databaseService) {
  return databaseService.db.installments.toArray();
}

export {
  saveCpcWithRelations,
  deleteCpcCascade,
  upsertCpcsAndSyncDetailLinks,
  putCpcItem,
  addCpcItem,
  updateCpcItemFields,
  replaceInstallmentsForCpc,
  getAllInstallments,
};
