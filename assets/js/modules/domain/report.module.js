import { APP_CONFIG } from "../../../../config/app.config.js";

function parseAccountingWorkbook(XLSX, workbook) {
  const sheet3311 = workbook.Sheets[APP_CONFIG.accountingSheets.gl3311];
  const sheet3312 = workbook.Sheets[APP_CONFIG.accountingSheets.gl3312];

  if (!sheet3311) {
    return { errorSheet: APP_CONFIG.accountingSheets.gl3311, data: null };
  }
  if (!sheet3312) {
    return { errorSheet: APP_CONFIG.accountingSheets.gl3312, data: null };
  }

  const data3311 = XLSX.utils.sheet_to_json(sheet3311, { header: 1, defval: null });
  const data3312 = XLSX.utils.sheet_to_json(sheet3312, { header: 1, defval: null });

  const excelData = {};

  const upsert = (vendorNo, vendorName) => {
    if (!excelData[vendorNo]) {
      excelData[vendorNo] = { vendorName: vendorName || null, gl3311: 0, gl3312: 0 };
    }
    if (vendorName && !excelData[vendorNo].vendorName) {
      excelData[vendorNo].vendorName = vendorName;
    }
  };

  data3311.forEach((row) => {
    const vendorNo = row[2] ? String(row[2]).trim() : null;
    if (!vendorNo) return;
    const vendorName = row[3] ? String(row[3]).trim() : null;
    const amount = parseFloat(row[17]);
    if (isNaN(amount)) return;

    upsert(vendorNo, vendorName);
    excelData[vendorNo].gl3311 = amount;
  });

  data3312.forEach((row) => {
    const vendorNo = row[2] ? String(row[2]).trim() : null;
    if (!vendorNo) return;
    const vendorName = row[3] ? String(row[3]).trim() : null;
    const amount = parseFloat(row[16]);
    if (isNaN(amount)) return;

    upsert(vendorNo, vendorName);
    excelData[vendorNo].gl3312 = amount;
  });

  return { errorSheet: null, data: excelData };
}

function getComparisonStatusBadgeClass(status) {
  switch (status) {
    case "Match":
      return "bg-success";
    case "Mismatch":
      return "bg-danger";
    case "Only in App":
      return "bg-info";
    case "Only in Accounting":
      return "bg-secondary";
    default:
      return "bg-light";
  }
}

export { parseAccountingWorkbook, getComparisonStatusBadgeClass };
