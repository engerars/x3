function toggleSwapExpanded(installments, swapItemId) {
  const originalInstallment = (installments || []).find((i) => i.id === swapItemId);
  if (!originalInstallment) return false;
  originalInstallment.isExpanded = !originalInstallment.isExpanded;
  return true;
}

export { toggleSwapExpanded };
