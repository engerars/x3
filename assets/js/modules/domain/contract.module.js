function buildDefaultCpcDetailsColumnVisibility(columnGroups, subColumns) {
  const defaults = { columnVisibility: {}, subColumnVisibility: {} };
  (columnGroups || []).forEach((col) => {
    defaults.columnVisibility[col.key] = true;
  });
  (subColumns || []).forEach((col) => {
    defaults.subColumnVisibility[col.key] = true;
  });
  return defaults;
}

function loadContractColumnSettingsState(contract, defaults) {
  if (contract && contract.columnSettings) {
    return {
      columnVisibility: { ...contract.columnSettings.columnVisibility },
      subColumnVisibility: { ...contract.columnSettings.subColumnVisibility },
    };
  }
  return {
    columnVisibility: defaults.columnVisibility,
    subColumnVisibility: defaults.subColumnVisibility,
  };
}

function toggleContractColumnVisibility(contract, currentViewState, type, key, defaults) {
  if (!contract) return null;

  if (!contract.columnSettings) {
    contract.columnSettings = defaults;
  }

  if (type === "column") {
    currentViewState.columnVisibility[key] = !currentViewState.columnVisibility[key];
    contract.columnSettings.columnVisibility[key] = currentViewState.columnVisibility[key];
  } else if (type === "subColumn") {
    currentViewState.subColumnVisibility[key] = !currentViewState.subColumnVisibility[key];
    contract.columnSettings.subColumnVisibility[key] = currentViewState.subColumnVisibility[key];
  }

  return contract;
}

function findRowIndexByContract(cpcDetailRows, selectedContractId, rowId) {
  if (!selectedContractId) return -1;
  const tableForContract = (cpcDetailRows || []).filter(
    (row) => row.contractId === selectedContractId
  );
  return tableForContract.findIndex((row) => row.id === rowId);
}

export {
  buildDefaultCpcDetailsColumnVisibility,
  loadContractColumnSettingsState,
  toggleContractColumnVisibility,
  findRowIndexByContract,
};
