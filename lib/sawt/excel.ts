// ─────────────────────────────────────────────────────────────────────────────
// lib/sawt/excel.ts
//
// SAWT Excel report generator — BIR Form 1701Q layout
//
// Design principles:
//   • Output concern only — no compliance logic lives here
//   • One row per uploaded 2307 form (itemized, not consolidated)
//   • Layout matches exact BIR SAVT Excel format
//   • Depends on lib/sawt/index.ts for types and helpers
//   • Depends on lib/sawt/atc-descriptions.ts for ATC map
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";
import type { SAWTClientInput, ExtractedForm } from "./index";
import { parseAmount, deriveAtc, SAWT_SCHEMA } from "./index";
import { ATC_DESCRIPTIONS } from "./atc-descriptions";

const MONTHS_LIST = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

export interface SAWTExcelResult {
  buffer: Uint8Array;
  filename: string;
}

export function generateSAWTExcel(
  client: SAWTClientInput,
  quarterNum: number,
  quarterForms: ExtractedForm[],
  yearStr: string,
  fullName: string,
  displayTin: string
): SAWTExcelResult {
  const lastMonth = quarterNum * 3;
  const monthName = MONTHS_LIST[lastMonth - 1];
  const excelFilename = `SAWT-${displayTin}-Q${quarterNum}-${yearStr}.xlsx`;

  const wb = XLSX.utils.book_new();
  const wsData: (string | number)[][] = [];

  // ── Header block ──
  wsData.push(["BIR FORM 1701Q"]);
  wsData.push(["SUMMARY ALPHALIST OF WITHHOLDING TAXES (SAVT)"]);
  wsData.push([`FOR THE MONTH OF ${monthName}, ${yearStr}`]);
  wsData.push([]);
  wsData.push([`TIN : ${displayTin}`]);
  wsData.push([`PAYEE'S NAME: ${fullName}`]);
  wsData.push([]);

  // ── Column headers ──
  wsData.push([
    "SEQ\nNO",
    "TAXPAYER\nIDENTIFICATION\nNUMBER",
    "CORPORATION\n(Registered Name)",
    "INDIVIDUAL\n(Last Name, First Name, Middle Name)",
    "ATC CODE",
    "NATURE OF PAYMENT",
    "AMOUNT OF\nINCOME PAYMENT",
    "TAX RATE",
    "AMOUNT OF\nTAX WITHHELD",
  ]);

  // ── Column number row ──
  wsData.push(["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", ""]);

  // ── Dotted separator ──
  wsData.push(Array(9).fill("........................"));

  // ── Data rows — one per uploaded 2307 form ──
  let totalIncome = 0;
  let totalTax = 0;

  quarterForms.forEach((form, i) => {
    const payorTinRaw = (form?.atc_tin || form?.payor_tin || "").replace(/\D/g, "");
    const payorTinMain = payorTinRaw.substring(0, 9).padEnd(9, "0");
    const payorTinFmt = `${payorTinMain.substring(0, 3)}-${payorTinMain.substring(3, 6)}-${payorTinMain.substring(6, 9)}-0000`;

    const payorName = (form?.payor_name || form?.client_name || "").toUpperCase().trim();
    const income = parseAmount(form?.total_income);
    const tax = parseAmount(form?.total_tax_withheld);
    const atc = deriveAtc(income, tax, form?.atc);
    const natureOfPayment = ATC_DESCRIPTIONS[atc] ?? atc;
    const rate = income > 0
      ? parseFloat((tax / income * 100).toFixed(2))
      : SAWT_SCHEMA.DEFAULT_RATE;

    totalIncome += income;
    totalTax += tax;

    wsData.push([
      i + 1,
      payorTinFmt,
      payorName,
      "",
      atc,
      natureOfPayment,
      income,
      rate,
      tax,
    ]);
  });

  // ── Dotted separator before grand total ──
  wsData.push(["", "", "", "", "", "", "........................", "........................", "........................"]);

  // ── Grand Total row ──
  wsData.push(["Grand Total :", "", "", "", "", "0.00", totalIncome, "", totalTax]);

  // ── Double underline separator ──
  wsData.push(["", "", "", "", "", "", "================", "================", "================"]);

  // ── END OF REPORT ──
  wsData.push([]);
  wsData.push(["END OF REPORT"]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ── Column widths ──
  ws["!cols"] = [
    { wch: 8 },   // A - SEQ NO
    { wch: 22 },  // B - TIN
    { wch: 42 },  // C - CORPORATION
    { wch: 42 },  // D - INDIVIDUAL
    { wch: 10 },  // E - ATC CODE
    { wch: 65 },  // F - NATURE OF PAYMENT
    { wch: 20 },  // G - AMOUNT OF INCOME
    { wch: 10 },  // H - TAX RATE
    { wch: 20 },  // I - AMOUNT OF TAX WITHHELD
  ];
// ── Number formatting ──
  const dataStartRow = 10; // row index where data rows begin (0-based)
  const dataEndRow = dataStartRow + quarterForms.length - 1;

  for (let r = dataStartRow; r <= dataEndRow; r++) {
    // Column G (income) = index 6, Column H (rate) = index 7, Column I (tax) = index 8
    const incomeCell = XLSX.utils.encode_cell({ r, c: 6 });
    const rateCell = XLSX.utils.encode_cell({ r, c: 7 });
    const taxCell = XLSX.utils.encode_cell({ r, c: 8 });

    if (ws[incomeCell]) ws[incomeCell].z = "#,##0.00";
    if (ws[rateCell]) ws[rateCell].z = "0.00";
    if (ws[taxCell]) ws[taxCell].z = "#,##0.00";
  }

  // Grand total row formatting
  const grandTotalRow = dataEndRow + 2;
  const gtIncomeCell = XLSX.utils.encode_cell({ r: grandTotalRow, c: 6 });
  const gtTaxCell = XLSX.utils.encode_cell({ r: grandTotalRow, c: 8 });
  if (ws[gtIncomeCell]) ws[gtIncomeCell].z = "#,##0.00";
  if (ws[gtTaxCell]) ws[gtTaxCell].z = "#,##0.00";

  XLSX.utils.book_append_sheet(wb, ws, "SAWT");

  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;

  return { buffer, filename: excelFilename };
}