function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function saveVendorRecord(databaseService, vendorInput, mode) {
  const vendorToSave = clone(vendorInput);

  if (mode === "add") {
    delete vendorToSave.id;
    const newId = await databaseService.db.vendors.add(vendorToSave);
    vendorToSave.id = newId;
  } else {
    await databaseService.updateVendor(vendorToSave);
  }

  return vendorToSave;
}

async function deleteVendorRecord(databaseService, vendorId) {
  await databaseService.db.vendors.delete(vendorId);
  return { vendorId };
}

async function deleteProjectRecord(databaseService, projectId) {
  await databaseService.db.projects.delete(projectId);
  return { projectId };
}

async function saveProjectRecord(databaseService, projectInput, mode) {
  const payload = clone(projectInput);
  if (mode === "add") {
    delete payload.id;
    const id = await databaseService.db.projects.add(payload);
    payload.id = id;
  } else {
    await databaseService.updateProject(payload);
  }
  return payload;
}

async function importVendors(databaseService, vendorsToAdd) {
  if (!Array.isArray(vendorsToAdd) || vendorsToAdd.length === 0) {
    return { importedCount: 0, vendors: await databaseService.db.vendors.toArray() };
  }

  await databaseService.db.transaction("rw", databaseService.db.vendors, async () => {
    await databaseService.db.vendors.bulkAdd(clone(vendorsToAdd));
  });

  const vendors = await databaseService.db.vendors.toArray();
  return { importedCount: vendorsToAdd.length, vendors };
}

async function mergeVendorReferences(databaseService, sourceVendorId, destinationVendorId) {
  await databaseService.db.transaction("rw", databaseService.db.tables, async () => {
    const contractsToUpdate = await databaseService.db.contracts
      .where("vendorId")
      .equals(sourceVendorId)
      .toArray();

    if (contractsToUpdate.length > 0) {
      const updatedContracts = contractsToUpdate.map((contract) => ({
        ...contract,
        vendorId: destinationVendorId,
      }));
      await databaseService.db.contracts.bulkPut(updatedContracts);
    }

    await databaseService.db.cpcItems
      .where("vendorId")
      .equals(sourceVendorId)
      .modify({ vendorId: destinationVendorId });
    await databaseService.db.installments
      .where("vendorId")
      .equals(sourceVendorId)
      .modify({ vendorId: destinationVendorId });
    await databaseService.db.bonds
      .where("vendorId")
      .equals(sourceVendorId)
      .modify({ vendorId: destinationVendorId });

    await databaseService.db.vendors.delete(sourceVendorId);
  });
}

export {
  saveVendorRecord,
  deleteVendorRecord,
  deleteProjectRecord,
  saveProjectRecord,
  importVendors,
  mergeVendorReferences,
};
