import { APP_CONFIG } from "../../../../config/app.config.js";

function buildMasterVendorTemplate(XLSX) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([], {
    header: APP_CONFIG.fileTemplates.masterDataVendorsHeaders,
  });
  XLSX.utils.book_append_sheet(wb, ws, APP_CONFIG.fileTemplates.masterDataVendorsSheet);
  return wb;
}

function getVendorRowsFromWorkbook(XLSX, workbook) {
  const sheetName = APP_CONFIG.fileTemplates.masterDataVendorsSheet;
  const sheet = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json(sheet, { raw: false, defval: null });
}

function buildVendorImportPayload(rows, existingVendors) {
  const vendorsToAdd = [];
  let addedCount = 0;
  let skippedCount = 0;

  const existingVendorNos = new Set(
    (existingVendors || []).map((v) => String(v.vendorNo || "").toLowerCase())
  );
  const processedInFile = new Set();

  (rows || []).forEach((row) => {
    const name = row.name?.toString().trim();
    const vendorNo = row.vendorNo?.toString().trim();
    if (!name || !vendorNo) return;

    const lowerVendorNo = vendorNo.toLowerCase();
    if (existingVendorNos.has(lowerVendorNo) || processedInFile.has(lowerVendorNo)) {
      skippedCount += 1;
      return;
    }

    vendorsToAdd.push({
      name,
      abbrName: row.abbrName?.toString().trim() || "",
      vendorNo,
      contactPerson: row.contactPerson?.toString().trim() || "",
      phoneNumber: row.phoneNumber?.toString().trim() || "",
    });

    processedInFile.add(lowerVendorNo);
    addedCount += 1;
  });

  return { vendorsToAdd, addedCount, skippedCount };
}

export {
  buildMasterVendorTemplate,
  getVendorRowsFromWorkbook,
  buildVendorImportPayload,
};
