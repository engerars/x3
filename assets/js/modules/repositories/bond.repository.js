function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function saveBondRecord(databaseService, bondInput, mode, contracts) {
  const bondToSave = clone(bondInput);
  delete bondToSave.displayAmount;

  const contract = contracts.find((c) => c.id === bondToSave.contractId);
  if (!contract) {
    const error = new Error("CONTRACT_NOT_FOUND");
    error.code = "CONTRACT_NOT_FOUND";
    throw error;
  }

  bondToSave.projectId = contract.projectId;
  bondToSave.vendorId = contract.vendorId;

  if (mode === "add") {
    delete bondToSave.id;
    const newId = await databaseService.db.bonds.add(bondToSave);
    bondToSave.id = newId;
  } else {
    await databaseService.db.bonds.put(bondToSave);
  }

  return bondToSave;
}

async function deleteBondCascade(databaseService, bondToDelete, bonds) {
  const originalBondId = bondToDelete?.renewedFromBondId;
  let originalBondToUpdate = null;

  if (originalBondId) {
    const originalBond = bonds.find((b) => b.id === originalBondId);
    if (originalBond) {
      originalBondToUpdate = clone(originalBond);
      originalBondToUpdate.isSettled = false;
      originalBondToUpdate.isRenewed = false;
      originalBondToUpdate.settlementReasonDisplay = "";
    }
  }

  await databaseService.db.transaction("rw", databaseService.db.bonds, async () => {
    await databaseService.db.bonds.delete(bondToDelete.id);
    if (originalBondToUpdate) {
      await databaseService.db.bonds.put(originalBondToUpdate);
    }
  });

  return {
    deletedBondId: bondToDelete.id,
    originalBondId,
    originalBondToUpdate,
  };
}

async function deleteBondsByIds(databaseService, bondIds) {
  if (!Array.isArray(bondIds) || bondIds.length === 0) {
    return { deletedBondIds: [] };
  }

  await databaseService.db.bonds.bulkDelete(bondIds);
  return { deletedBondIds: bondIds };
}

async function renewBondRecord(
  databaseService,
  bonds,
  currentRenewBond,
  newBondDetails,
  renewedStatusLabel
) {
  const originalBondIndex = bonds.findIndex((b) => b.id === currentRenewBond.id);
  if (originalBondIndex === -1) {
    const error = new Error("ORIGINAL_BOND_NOT_FOUND");
    error.code = "ORIGINAL_BOND_NOT_FOUND";
    throw error;
  }

  const originalBondToUpdate = clone(bonds[originalBondIndex]);
  originalBondToUpdate.isRenewed = true;
  originalBondToUpdate.isSettled = true;
  originalBondToUpdate.settlementReasonDisplay = renewedStatusLabel;

  const newBond = {
    ...clone(newBondDetails),
    renewedFromBondId: currentRenewBond.id,
    contractId: currentRenewBond.contractId,
    projectId: currentRenewBond.projectId,
    vendorId: currentRenewBond.vendorId,
  };
  delete newBond.cpcId;
  delete newBond.id;
  delete newBond.displayAmount;

  await databaseService.db.transaction("rw", databaseService.db.bonds, async () => {
    await databaseService.db.bonds.put(clone(originalBondToUpdate));
    const newId = await databaseService.db.bonds.add(clone(newBond));
    newBond.id = newId;
  });

  return { originalBondIndex, originalBondToUpdate, newBond };
}

async function applyBondUploadChanges(databaseService, bondsToAdd, bondsToUpdate) {
  const addPayload = clone(bondsToAdd || []);
  const updatePayload = clone(bondsToUpdate || []);

  await databaseService.db.transaction("rw", databaseService.db.bonds, async () => {
    if (addPayload.length > 0) {
      await databaseService.db.bonds.bulkAdd(addPayload);
    }
    if (updatePayload.length > 0) {
      await databaseService.db.bonds.bulkPut(updatePayload);
    }
  });

  return { addedCount: addPayload.length, updatedCount: updatePayload.length };
}

async function putBondRecord(databaseService, bondData) {
  const payload = clone(bondData);
  await databaseService.db.bonds.put(payload);
  return payload;
}

export {
  saveBondRecord,
  deleteBondCascade,
  deleteBondsByIds,
  renewBondRecord,
  applyBondUploadChanges,
  putBondRecord,
};
