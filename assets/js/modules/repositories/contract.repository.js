function normalizeText(value) {
  return (value || "").toString().trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

async function putContractRecord(databaseService, contractData) {
  const payload = JSON.parse(JSON.stringify(contractData));
  await databaseService.db.contracts.put(payload);
  return payload;
}

function buildContractPayload(editContract, projectId, vendorId) {
  const contractData = JSON.parse(JSON.stringify(editContract));
  contractData.projectId = projectId;
  contractData.vendorId = vendorId;
  delete contractData.projectName;
  delete contractData.vendorName;
  delete contractData.vendorAbbrName;
  delete contractData.vendorNo;
  return contractData;
}

async function saveContractFromModal(databaseService, editContract, mode) {
  const project = await databaseService.findOrCreateEntity(
    "projects",
    "name",
    normalizeText(editContract.projectName)
  );

  const vendor = await databaseService.findOrCreateEntity(
    "vendors",
    "vendorNo",
    normalizeText(editContract.vendorNo)
  );

  if (vendor) {
    let vendorNeedsUpdate = false;
    const nextVendorName = normalizeText(editContract.vendorName);
    const nextVendorAbbr = normalizeText(editContract.vendorAbbrName || "");

    if (vendor.name !== nextVendorName) {
      vendor.name = nextVendorName;
      vendorNeedsUpdate = true;
    }
    if ((vendor.abbrName || "") !== nextVendorAbbr) {
      vendor.abbrName = nextVendorAbbr;
      vendorNeedsUpdate = true;
    }
    if (vendorNeedsUpdate) {
      await databaseService.updateVendor(vendor);
    }
  }

  const contractData = buildContractPayload(editContract, project.id, vendor.id);

  if (mode === "add") {
    delete contractData.id;
    const newId = await databaseService.db.contracts.add(contractData);
    contractData.id = newId;
  } else {
    await databaseService.updateContract(contractData);
  }

  return contractData;
}

async function deleteContractCascade(databaseService, contractId) {
  const cpcItemsToDelete = await databaseService.db.cpcItems
    .where("contractId")
    .equals(contractId)
    .toArray();
  const cpcItemIdsToDelete = cpcItemsToDelete.map((cpc) => cpc.id);

  await databaseService.db.transaction(
    "rw",
    databaseService.db.tables,
    async () => {
      if (cpcItemIdsToDelete.length > 0) {
        await databaseService.db.installments
          .where("cpcId")
          .anyOf(cpcItemIdsToDelete)
          .delete();
        await databaseService.db.bonds
          .where("cpcId")
          .anyOf(cpcItemIdsToDelete)
          .delete();
      }

      await databaseService.db.cpcItems.where("contractId").equals(contractId).delete();
      await databaseService.db.cpcDetailRows.where("contractId").equals(contractId).delete();
      await databaseService.db.contracts.delete(contractId);
    }
  );

  return { cpcItemIdsToDelete };
}

async function deleteContractsCascade(databaseService, contractIds) {
  if (!Array.isArray(contractIds) || contractIds.length === 0) {
    return { cpcItemIdsToDelete: [] };
  }

  const cpcItemsToDelete = await databaseService.db.cpcItems
    .where("contractId")
    .anyOf(contractIds)
    .toArray();
  const cpcItemIdsToDelete = cpcItemsToDelete.map((cpc) => cpc.id);

  await databaseService.db.transaction("rw", databaseService.db.tables, async () => {
    if (cpcItemIdsToDelete.length > 0) {
      await databaseService.db.installments
        .where("cpcId")
        .anyOf(cpcItemIdsToDelete)
        .delete();
      await databaseService.db.bonds.where("cpcId").anyOf(cpcItemIdsToDelete).delete();
    }

    await databaseService.db.cpcItems.where("contractId").anyOf(contractIds).delete();
    await databaseService.db.cpcDetailRows.where("contractId").anyOf(contractIds).delete();
    await databaseService.db.contracts.bulkDelete(contractIds);
  });

  return { cpcItemIdsToDelete };
}

async function mergeContractsFromRows(databaseService, rows, currentState) {
  const { vendors, projects, contracts } = currentState;
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const skippedContractsInfo = [];

  for (const row of rows) {
    const contractNoTrimmed = normalizeText(row.contractNo);
    const vendorNoTrimmed = normalizeText(row.vendorNo);

    if (!contractNoTrimmed || !vendorNoTrimmed) {
      skippedCount += 1;
      skippedContractsInfo.push({
        contractNo: contractNoTrimmed || "Thiếu",
        vendorNo: vendorNoTrimmed || "Thiếu",
        reason: "Thiếu mã Hợp đồng hoặc mã NCC.",
      });
      continue;
    }

    const vendor = vendors.find(
      (v) => normalizeLower(v.vendorNo) === normalizeLower(vendorNoTrimmed)
    );
    if (!vendor) {
      skippedCount += 1;
      skippedContractsInfo.push({
        contractNo: contractNoTrimmed,
        vendorNo: vendorNoTrimmed,
        reason: `Mã NCC '${vendorNoTrimmed}' không tồn tại trong Master Data.`,
      });
      continue;
    }

    let project = null;
    if (normalizeText(row.project)) {
      const projectName = normalizeText(row.project);
      project = projects.find((p) => normalizeLower(p.name) === normalizeLower(projectName));
      if (!project) {
        project = { name: projectName };
        const newId = await databaseService.db.projects.add(project);
        project.id = newId;
        projects.push(project);
      }
    }

    const existingContractIndex = contracts.findIndex(
      (c) => normalizeLower(c.contractNo) === normalizeLower(contractNoTrimmed)
    );

    if (existingContractIndex !== -1) {
      const existing = contracts[existingContractIndex];
      if (project) existing.projectId = project.id;
      existing.vendorId = vendor.id;
      if (row.date != null) existing.date = row.date;
      if (row.description != null) existing.description = row.description;
      if (row.glAccount != null) existing.glAccount = row.glAccount;
      if (row.code != null) existing.code = row.code;
      if (row.department != null) existing.department = row.department;
      if (row.contractSystemNo != null) existing.contractSystemNo = row.contractSystemNo;
      if (row.currency != null) existing.currency = row.currency;
      if (row.status != null) existing.status = row.status;
      if (row.statusNote != null) existing.statusNote = row.statusNote;
      updatedCount += 1;
    } else {
      contracts.push({
        projectId: project ? project.id : null,
        vendorId: vendor.id,
        contractNo: contractNoTrimmed,
        date: row.date || "",
        description: row.description || "",
        glAccount: row.glAccount || "",
        code: row.code || "",
        department: row.department || "",
        contractSystemNo: row.contractSystemNo || "",
        currency: row.currency || "VND",
        status: row.status || "Active",
        statusNote: row.statusNote || "",
        settings: {
          repaymentThreshold: 80,
          retentionRate: 5,
          defaultVatRate: 8,
        },
      });
      addedCount += 1;
    }
  }

  return { addedCount, updatedCount, skippedCount, skippedContractsInfo };
}

export {
  putContractRecord,
  saveContractFromModal,
  deleteContractCascade,
  deleteContractsCascade,
  mergeContractsFromRows,
};
