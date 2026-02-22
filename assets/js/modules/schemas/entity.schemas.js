function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function validateContractInput(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return ["Dữ liệu hợp đồng không hợp lệ."];
  }
  if (isBlank(payload.contractNo)) errors.push("Thiếu số hợp đồng.");
  if (isBlank(payload.projectName)) errors.push("Thiếu tên dự án.");
  if (isBlank(payload.vendorNo)) errors.push("Thiếu mã NCC.");
  if (isBlank(payload.vendorName)) errors.push("Thiếu tên NCC.");
  return errors;
}

function validateCpcInput(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return ["Dữ liệu CPC không hợp lệ."];
  }
  if (isBlank(payload.projectName)) errors.push("Thiếu dự án.");
  if (isBlank(payload.vendorName)) errors.push("Thiếu nhà cung cấp.");
  if (typeof payload.amount !== "number" || Number.isNaN(payload.amount)) {
    errors.push("Giá trị amount của CPC không hợp lệ.");
  }
  if (!Array.isArray(payload.installments)) {
    errors.push("Danh sách installments không hợp lệ.");
  }
  return errors;
}

function validateInstallmentInput(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return ["Dữ liệu thanh toán không hợp lệ."];
  }
  if (payload.id === null || payload.id === undefined) {
    errors.push("Thiếu id đợt thanh toán.");
  }
  if (typeof payload.amount !== "number" || Number.isNaN(payload.amount)) {
    errors.push("Giá trị amount không hợp lệ.");
  }
  return errors;
}

function validateBondInput(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return ["Dữ liệu bảo lãnh không hợp lệ."];
  }
  if (!payload.contractId) errors.push("Thiếu hợp đồng.");
  if (isBlank(payload.bondNumber)) errors.push("Thiếu số bảo lãnh.");
  if (typeof payload.amount !== "number" || Number.isNaN(payload.amount)) {
    errors.push("Giá trị amount của bảo lãnh không hợp lệ.");
  }
  return errors;
}

export {
  validateContractInput,
  validateCpcInput,
  validateInstallmentInput,
  validateBondInput,
};
