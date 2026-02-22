function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function updateInstallment(databaseService, installments, editedInstallment) {
  const instIndex = installments.findIndex((i) => i.id === editedInstallment.id);
  if (instIndex === -1) {
    throw new Error("INSTALLMENT_NOT_FOUND");
  }

  const installmentToUpdate = clone(installments[instIndex]);
  installmentToUpdate.paymentSource = editedInstallment.paymentSource;
  installmentToUpdate.amount = editedInstallment.amount;
  installmentToUpdate.date = editedInstallment.date;

  await databaseService.db.installments.put(installmentToUpdate);
  return { installmentToUpdate, instIndex };
}

async function saveSwapInstallment(
  databaseService,
  installments,
  currentEditSwap,
  isSwapFullyPaid
) {
  const installmentIndex = installments.findIndex((i) => i.id === currentEditSwap.id);
  if (installmentIndex === -1) {
    throw new Error("INSTALLMENT_NOT_FOUND");
  }

  const updatedSwapData = clone(currentEditSwap);
  const installmentToUpdate = clone(installments[installmentIndex]);

  Object.assign(installmentToUpdate, {
    vendorSWAP: updatedSwapData.vendorSWAP,
    swapAgreement: updatedSwapData.swapAgreement,
    swapProduct: updatedSwapData.swapProduct,
    swapInformation: updatedSwapData.swapInformation,
    swapDueDatePayment: updatedSwapData.swapDueDatePayment,
    date: updatedSwapData.date,
    swapPayments: (updatedSwapData.swapPayments || []).map((p) => {
      const payment = clone(p);
      delete payment.displayAmount;
      return payment;
    }),
  });

  installmentToUpdate.isSwapPaid = isSwapFullyPaid(installmentToUpdate);

  await databaseService.db.installments.put(installmentToUpdate);
  return { installmentToUpdate, installmentIndex };
}

export { updateInstallment, saveSwapInstallment };
