/* eslint-disable @typescript-eslint/no-explicit-any */

// ─────────────────────────────────────────────────────────────────────────────
// lib/sawt/index.ts
//
// Philippine SAWT 1701Q — Compliance Core
// Single source of truth for: schema constants, parsing, validation, generation
//
// Design principles:
//   • Every function is pure (no DB, no UI, no filesystem)
//   • Same input → same output, always
//   • All normalizations are explicit — nothing silent
//   • Validator is stricter than BIR, so users trust it before submission
// ─────────────────────────────────────────────────────────────────────────────


// ── 1. SCHEMA CONSTANTS ───────────────────────────────────────────────────────
// One place for every magic number. If BIR changes a spec, change it here.

export const SAWT_SCHEMA = {
  // Field counts per record type
  HEADER_FIELDS: 10,
  DETAIL_FIELDS: 15,
  CONTROL_FIELDS: 7,

  // TIN formatting
  TIN_MAIN_LENGTH: 9,
  TIN_BRANCH_LENGTH: 4,
  DEFAULT_BRANCH: "0000",
  DEFAULT_RDO: "015",

  // Valid quarter-end months for the period field
  VALID_QUARTER_MONTHS: [3, 6, 9, 12],

  // Default withholding rate when income is zero
  DEFAULT_RATE: 2.00,

  // Record type identifiers
  RECORD_TYPES: {
    HEADER: "HSAWT",
    DETAIL: "DSAWT",
    CONTROL: "CSAWT",
  },

  // Form codes per record
  FORM_CODES: {
    HEADER: "H1701Q",
    DETAIL: "D1701Q",
    CONTROL: "C1701Q",
  },

  // Tolerance for C-line totals reconciliation (centavo rounding)
  RECONCILIATION_TOLERANCE: 0.05,

  // Tolerance for rate-vs-computed variance warning
  RATE_VARIANCE_TOLERANCE: 0.10,
} as const;


// ── 2. TYPES ──────────────────────────────────────────────────────────────────

export type ValidationSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
}

export interface LineResult {
  lineNum: string;
  type: string;       // "H" | "D" | "C" | "UNKNOWN"
  line: string;
  errors: string[];
  warnings: string[];
}

export interface DATValidationResult {
  filename: string;
  hInfo: {
    tin: string;
    name: string;
    period: string;
    rdo: string;
    dCount: number;
  } | null;
  lineResults: LineResult[];
  structErrors: string[];
  errorCount: number;
  warnCount: number;
  txtReport: string;
  passed: boolean;
}

export interface PayorEntry {
  payorName: string;
  atc: string;
  income: number;
  tax: number;
}

export interface SAWTClientInput {
  tin: string;
  lastName: string;
  firstName: string;
  middleName: string;
  rdoCode: string;
}

export interface SAWTGenerationResult {
  datContent: string;
  datFilename: string;
  html: string;
  tinMain: string;
  tinBranch: string;
  displayTin: string;
  fullName: string;
  payorCount: number;
  totalIncome: number;
  totalTax: number;
}

export interface ExtractedForm {
  atc_tin?: string;
  payor_tin?: string;
  payor_name?: string;
  client_name?: string;
  atc?: string;
  total_income?: string | number;
  total_tax_withheld?: string | number;
  period_to?: string;
  period_from?: string;
  payee_tin?: string;
  payee_name?: string;
  [key: string]: any;
}


// ── 3. PRIMITIVE HELPERS ──────────────────────────────────────────────────────
// Small, testable, reusable. No side effects.

/** Strip surrounding quotes and trim whitespace from a CSV field value */
export function stripQuotes(s: any): string {
  return (s || "").replace(/^"|"$/g, "").trim();
}

/** Validate that a string is exactly 9 digits (TIN main) */
export function isValidTin(t: string): boolean {
  return /^\d{9}$/.test(t);
}

/** Validate that a string is exactly 4 digits (TIN branch) */
export function isValidBranch(t: string): boolean {
  return /^\d{4}$/.test(t);
}

/** Validate that a string is a non-negative number with up to 2 decimal places */
export function isValidAmount(a: string | number): boolean {
  return /^\d+(\.\d{1,2})?$/.test(String(a)) && !isNaN(parseFloat(String(a)));
}

/** Parse a BIR period string "MM/YYYY" into month and year integers, or null */
export function parsePeriod(p: string): { month: number; year: number } | null {
  const m = (p || "").match(/^(\d{2})\/(\d{4})$/);
  return m ? { month: parseInt(m[1]), year: parseInt(m[2]) } : null;
}

/** Detect characters outside the BIR-allowed set for payor names */
export function hasSpecialChars(s: string): boolean {
  return /[^A-Z0-9\s.,\-/()?&]/.test(s);
}

/** Parse a potentially double-encoded JSON string from extracted_data */
export function parseExtractedData(data: any): any {
  try {
    let parsed = data;
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return parsed;
  } catch {
    return data;
  }
}

/** Normalize a raw amount string or number to a float */
export function parseAmount(val: string | number | undefined): number {
  return parseFloat(String(val || "0").replace(/,/g, "")) || 0;
}

/** Normalize a raw TIN string to 9-digit main + 4-digit branch */
export function normalizeTin(raw: string): { main: string; branch: string; display: string } {
  const digits = raw.replace(/\D/g, "");
  const main = digits.substring(0, SAWT_SCHEMA.TIN_MAIN_LENGTH).padEnd(SAWT_SCHEMA.TIN_MAIN_LENGTH, "0");
  const branch = digits.substring(SAWT_SCHEMA.TIN_MAIN_LENGTH, SAWT_SCHEMA.TIN_MAIN_LENGTH + SAWT_SCHEMA.TIN_BRANCH_LENGTH).padEnd(SAWT_SCHEMA.TIN_BRANCH_LENGTH, "0");
  const display = `${main.substring(0,3)}-${main.substring(3,6)}-${main.substring(6,9)}-${branch}`;
  return { main, branch, display };
}

/** Format a number as Philippine peso with 2 decimal places */
export function fmtPeso(n: number): string {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


// ── 4. CSV PARSER (quote-aware) ───────────────────────────────────────────────
// Replaces the fragile line.split(",") that breaks on quoted commas.
// e.g.  DSAWT,D1701Q,1,603223867,0000,"BEEHIVE ADAPTIVE, INC",,,,03/2026,,WI120,...
//                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^
//       This field contains a comma inside quotes — naive split corrupts it.

export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped double-quote "" inside a quoted field
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch; // preserve quote chars so stripQuotes() can clean them
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current); // last field
  return fields;
}

// ── 4b. ATC MAP & FALLBACK ────────────────────────────────────────────────────
// If Claude omits the atc field, derive it from the effective withholding rate.
// Rate is computed as (tax / income * 100), rounded to nearest whole percent.
// Source: BIR Revenue Regulations on creditable withholding tax.

export const ATC_MAP: Record<number, string> = {
  1:  "WI157",   // 1%  — income payments to contractors/subcontractors (small)
  2:  "WI120",   // 2%  — income payments to contractors/subcontractors (general)
  5:  "WI158",   // 5%  — professionals, talent fees
  10: "WI160",   // 10% — professionals (>720k), rental
  15: "WI161",   // 15% — certain income payments
};

/**
 * Derive ATC from the effective withholding rate when atc field is missing.
 * Falls back to WI120 (2%) if rate doesn't match any known entry.
 */
export function deriveAtc(income: number, tax: number, rawAtc?: string): string {
  // Use whatever Claude extracted if it looks valid
  if (rawAtc && /^[A-Z]{2}\d{3,4}$/.test(rawAtc.trim())) {
    return rawAtc.trim();
  }
  if (income <= 0 || tax <= 0) return "WI120";
  const rate = Math.round((tax / income) * 100);
  return ATC_MAP[rate] ?? "WI120";
}
// ── 5. PAYOR CONSOLIDATION ────────────────────────────────────────────────────
// BIR rule: one D line per payor TIN per SAWT.
// Multiple 2307s from the same payor must be summed into a single D line.

export function buildPayorMap(quarterForms: ExtractedForm[]): Map<string, PayorEntry> {
  const payorMap = new Map<string, PayorEntry>();

  quarterForms.forEach((f) => {
    const payorTin = (f?.atc_tin || f?.payor_tin || "")
      .replace(/\D/g, "")
      .substring(0, SAWT_SCHEMA.TIN_MAIN_LENGTH)
      .padEnd(SAWT_SCHEMA.TIN_MAIN_LENGTH, "0");

    const payorName = (f?.payor_name || f?.client_name || "")
      .toUpperCase()
      .replace(/"/g, "")
      .replace(/\.$/, "")
      .trim();

    const income = parseAmount(f?.total_income);
    const tax = parseAmount(f?.total_tax_withheld);
    const atc = deriveAtc(income, tax, f?.atc);

    if (payorMap.has(payorTin)) {
      const existing = payorMap.get(payorTin)!;
      existing.income += income;
      existing.tax += tax;
    } else {
      payorMap.set(payorTin, { payorName, atc, income, tax });
    }
  });

  return payorMap;
}


// ── 6. DAT VALIDATOR ──────────────────────────────────────────────────────────
// Validates a raw DAT file string against BIR SAWT 1701Q rules.
// Returns a structured result — no side effects, no UI concerns.

export function validateDAT(filename: string, raw: string): DATValidationResult {
  const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim() !== "");
  const lineResults: LineResult[] = [];
  let hLine: { idx: number; fields: string[] } | null = null;
  let cLine: { idx: number; fields: string[] } | null = null;
  const dLines: { idx: number; fields: string[]; lineNum: string }[] = [];
  let errorCount = 0;
  let warnCount = 0;
  const payorTinsSeen: Record<string, string> = {};

  lines.forEach((line, idx) => {
    const lineNum = String(idx + 1).padStart(10, "0");
    // ← quote-aware parser replaces line.split(",")
    const fields = parseCSVLine(line);
    const type = fields[0];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (type === SAWT_SCHEMA.RECORD_TYPES.HEADER) {
      hLine = { idx, fields };
      if (fields.length < SAWT_SCHEMA.HEADER_FIELDS) {
        errors.push(`H line must have at least ${SAWT_SCHEMA.HEADER_FIELDS} fields`);
      } else {
        if (fields[1] !== SAWT_SCHEMA.FORM_CODES.HEADER)
          errors.push(`Form code must be ${SAWT_SCHEMA.FORM_CODES.HEADER}, got "${fields[1]}"`);
        if (!isValidTin(fields[2]))
          errors.push(`TIN main must be exactly ${SAWT_SCHEMA.TIN_MAIN_LENGTH} digits, got "${fields[2]}"`);
        if (!isValidBranch(fields[3]))
          errors.push(`TIN branch must be exactly ${SAWT_SCHEMA.TIN_BRANCH_LENGTH} digits, got "${fields[3]}"`);
        const period = parsePeriod(fields[8]);
        if (!period) {
          errors.push(`Period must be MM/YYYY format, got "${fields[8]}"`);
        } else if (!(SAWT_SCHEMA.VALID_QUARTER_MONTHS as readonly number[]).includes(period.month)) {
          warnings.push(`Period month ${String(period.month).padStart(2, "0")} is not a quarter-end month (expected 03, 06, 09, or 12)`);
        }
        if (!stripQuotes(fields[9])) warnings.push("RDO code is blank");
        if (!stripQuotes(fields[5])) errors.push("Last name is blank on H line");
        if (!stripQuotes(fields[6])) errors.push("First name is blank on H line");
      }

    } else if (type === SAWT_SCHEMA.RECORD_TYPES.DETAIL) {
      dLines.push({ idx, fields, lineNum });
      if (fields.length < SAWT_SCHEMA.DETAIL_FIELDS) {
        errors.push(`D line must have at least ${SAWT_SCHEMA.DETAIL_FIELDS} fields`);
      } else {
        if (fields[1] !== SAWT_SCHEMA.FORM_CODES.DETAIL)
          errors.push(`Form code must be ${SAWT_SCHEMA.FORM_CODES.DETAIL}, got "${fields[1]}"`);
        const seq = parseInt(fields[2]);
        if (isNaN(seq)) {
          errors.push(`Sequence number must be numeric, got "${fields[2]}"`);
        } else if (seq !== dLines.length) {
          errors.push(`Sequence number ${seq} is out of order — expected ${dLines.length}`);
        }
        if (!isValidTin(fields[3])) {
          errors.push(`Payor TIN main must be exactly ${SAWT_SCHEMA.TIN_MAIN_LENGTH} digits, got "${fields[3]}"`);
        } else {
          if (payorTinsSeen[fields[3]]) {
            errors.push(`Duplicate payor TIN ${fields[3]} — already appears on line ${payorTinsSeen[fields[3]]}`);
          } else {
            payorTinsSeen[fields[3]] = lineNum;
          }
        }
        if (!isValidBranch(fields[4]))
          errors.push(`Payor TIN branch must be ${SAWT_SCHEMA.TIN_BRANCH_LENGTH} digits, got "${fields[4]}"`);
        const payorName = stripQuotes(fields[5]);
        if (!payorName) {
          errors.push("Payor name is blank");
        } else {
          if (payorName !== payorName.toUpperCase())
            errors.push(`Payor name must be uppercase: "${payorName}"`);
          if (hasSpecialChars(payorName))
            warnings.push("Payor name contains special characters that may cause rejection");
          if (payorName.endsWith("."))
            warnings.push("Payor name ends with a period which BIR may reject");
        }
        const dPeriod = parsePeriod(fields[9]);
        if (!dPeriod) {
          errors.push(`Period must be MM/YYYY format, got "${fields[9]}"`);
        } else if (hLine && fields[9] !== hLine.fields[8]) {
          errors.push(`D line period ${fields[9]} does not match H line period ${hLine.fields[8]}`);
        }
        if (!(fields[11] || "").trim()) errors.push("ATC is blank");
        const rate = parseFloat(fields[12]);
        if (isNaN(rate) || rate <= 0)
          errors.push(`Rate must be a positive number, got "${fields[12]}"`);
        if (!isValidAmount(fields[13]))
          errors.push(`Income must be a valid amount, got "${fields[13]}"`);
        if (!isValidAmount(fields[14]))
          errors.push(`Tax withheld must be a valid amount, got "${fields[14]}"`);
        if (isValidAmount(fields[13]) && isValidAmount(fields[14])) {
          const income = parseFloat(fields[13]);
          const tax = parseFloat(fields[14]);
          if (tax === 0) {
            errors.push("Tax withheld is ₱0.00 — a D line with zero tax is invalid");
          } else if (!isNaN(rate) && rate > 0) {
            const expected = income * (rate / 100);
            const diff = Math.abs(expected - tax);
            if (diff > SAWT_SCHEMA.RATE_VARIANCE_TOLERANCE) {
              warnings.push(`Rate (${rate}%) × income (${income.toFixed(2)}) = ${expected.toFixed(2)} but tax withheld is ${tax.toFixed(2)} — difference of ₱${diff.toFixed(2)}`);
            }
          }
        }
      }

    } else if (type === SAWT_SCHEMA.RECORD_TYPES.CONTROL) {
      cLine = { idx, fields };
      if (fields.length < SAWT_SCHEMA.CONTROL_FIELDS) {
        errors.push(`C line must have at least ${SAWT_SCHEMA.CONTROL_FIELDS} fields`);
      } else {
        if (fields[1] !== SAWT_SCHEMA.FORM_CODES.CONTROL)
          errors.push(`Form code must be ${SAWT_SCHEMA.FORM_CODES.CONTROL}, got "${fields[1]}"`);
        if (!isValidTin(fields[2]))
          errors.push(`TIN main must be exactly ${SAWT_SCHEMA.TIN_MAIN_LENGTH} digits`);
        if (!isValidBranch(fields[3]))
          errors.push(`TIN branch must be exactly ${SAWT_SCHEMA.TIN_BRANCH_LENGTH} digits`);
        if (!parsePeriod(fields[4]))
          errors.push(`Period must be MM/YYYY format, got "${fields[4]}"`);
        if (!isValidAmount(fields[5]))
          errors.push("Total income is not a valid amount");
        if (!isValidAmount(fields[6]))
          errors.push("Total tax withheld is not a valid amount");
      }
    } else {
      errors.push(`Unknown record type "${type}" — expected HSAWT, DSAWT, or CSAWT`);
    }

    errorCount += errors.length;
    warnCount += warnings.length;
    lineResults.push({
      lineNum,
      type: type.replace("SAWT", ""),
      line,
      errors,
      warnings,
    });
  });

  // ── Structural validation ──
  const structErrors: string[] = [];
  if (!hLine) structErrors.push("Missing H (header) record — file must start with HSAWT line");
  if (!cLine) structErrors.push("Missing C (control total) record — file must end with CSAWT line");
  if (dLines.length === 0) structErrors.push("No D (detail) records found — at least one DSAWT line required");
  if (hLine && cLine && (hLine as any).idx > (cLine as any).idx)
    structErrors.push("H record must appear before C record");
  if (cLine && dLines.some((d) => d.idx > (cLine as any).idx))
    structErrors.push("All D records must appear before the C record");

  if (hLine && cLine && dLines.length > 0) {
    const h = hLine as any;
    const c = cLine as any;
    const cIncome = parseFloat(c.fields[5]) || 0;
    const cTax = parseFloat(c.fields[6]) || 0;
    const sumIncome = dLines.reduce((s, d) => s + (parseFloat(d.fields[13]) || 0), 0);
    const sumTax = dLines.reduce((s, d) => s + (parseFloat(d.fields[14]) || 0), 0);
    const tol = SAWT_SCHEMA.RECONCILIATION_TOLERANCE;
    if (Math.abs(cIncome - sumIncome) > tol)
      structErrors.push(`C total income ${cIncome.toFixed(2)} ≠ sum of D lines ${sumIncome.toFixed(2)} — difference of ₱${Math.abs(cIncome - sumIncome).toFixed(2)}`);
    if (Math.abs(cTax - sumTax) > tol)
      structErrors.push(`C total tax ${cTax.toFixed(2)} ≠ sum of D lines ${sumTax.toFixed(2)} — difference of ₱${Math.abs(cTax - sumTax).toFixed(2)}`);
    if (h.fields[2] !== c.fields[2])
      structErrors.push(`TIN mismatch: H line has ${h.fields[2]}, C line has ${c.fields[2]}`);
    if (h.fields[8] !== c.fields[4])
      structErrors.push(`Period mismatch: H line has ${h.fields[8]}, C line has ${c.fields[4]}`);
  }
  errorCount += structErrors.length;

  // ── hInfo summary ──
  const hInfo = hLine ? (() => {
    const h = hLine as any;
    return {
      tin: `${h.fields[2]}-${h.fields[3]}`,
      name: [stripQuotes(h.fields[5] || ""), stripQuotes(h.fields[6] || ""), stripQuotes(h.fields[7] || "")].filter(Boolean).join(", "),
      period: h.fields[8],
      rdo: stripQuotes(h.fields[9] || ""),
      dCount: dLines.length,
    };
  })() : null;

  // ── BIR-style TXT report ──
  let txtReport = "";
  if (hInfo) {
    txtReport += `TIN of Withholding Agent TIN: ${hInfo.tin}\nAlphalist Form              : 1701Q\nTaxable Month               : ${hInfo.period}\n\n`;
  }
  txtReport += `LINE NUM       SCHEDULE     ERROR DESCRIPTION\n----------     --------     ------------------------------------------------------------\n`;
  if (errorCount === 0 && warnCount === 0) {
    txtReport += `0000000000                  No Errors Encountered\n`;
  } else {
    structErrors.forEach((e) => { txtReport += `0000000000     STRUCT       ${e}\n`; });
    lineResults.forEach((r) => {
      r.errors.forEach((e) => { txtReport += `${r.lineNum}     ${r.type.padEnd(8)} ${e}\n`; });
      r.warnings.forEach((w) => { txtReport += `${r.lineNum}     ${r.type.padEnd(8)} [WARN] ${w}\n`; });
    });
  }
  txtReport += `----------     --------     ------------------------------------------------------------\n`;

  return { filename, hInfo, lineResults, structErrors, errorCount, warnCount, txtReport, passed: errorCount === 0 };
}


// ── 7. SAWT GENERATOR ────────────────────────────────────────────────────────
// Pure function: accepts structured data, returns DAT string + HTML string.
// Zero side effects — no DB, no UI, no downloads.

const MONTHS_LIST = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

export function generateSAWTContent(
  client: SAWTClientInput,
  quarterNum: number,
  quarterForms: ExtractedForm[],
  yearStr: string
): SAWTGenerationResult {
  const { main: tinMain, branch: tinBranch, display: displayTin } = normalizeTin(client.tin);
  const { lastName, firstName, middleName } = client;
  const rdo = client.rdoCode || SAWT_SCHEMA.DEFAULT_RDO;

  const lastMonth = quarterNum * 3;
  const lastMonthPadded = String(lastMonth).padStart(2, "0");
  const period = `${lastMonthPadded}/${yearStr}`;
  const monthName = MONTHS_LIST[lastMonth - 1];
  const fullName = `${lastName}, ${firstName} ${middleName}`.trim();

  const totalIncome = quarterForms.reduce((sum, f) => sum + parseAmount(f?.total_income), 0);
  const totalTax = quarterForms.reduce((sum, f) => sum + parseAmount(f?.total_tax_withheld), 0);

  const payorMap = buildPayorMap(quarterForms);

  // ── DAT lines ──
  const lines: string[] = [];
  lines.push(`HSAWT,${SAWT_SCHEMA.FORM_CODES.HEADER},${tinMain},${tinBranch},"","${lastName}","${firstName}","${middleName}",${period},${rdo}`);
  Array.from(payorMap.entries()).forEach(([payorTin, p], i) => {
    const rate = p.income > 0
      ? parseFloat((p.tax / p.income * 100).toFixed(2))
      : SAWT_SCHEMA.DEFAULT_RATE;
    lines.push(`DSAWT,${SAWT_SCHEMA.FORM_CODES.DETAIL},${i + 1},${payorTin},${SAWT_SCHEMA.DEFAULT_BRANCH},"${p.payorName}",,,,${period},,${p.atc},${rate.toFixed(2)},${p.income.toFixed(2)},${p.tax.toFixed(2)}`);
  });
  lines.push(`CSAWT,${SAWT_SCHEMA.FORM_CODES.CONTROL},${tinMain},${tinBranch},${period},${totalIncome.toFixed(2)},${totalTax.toFixed(2)}`);

  const datContent = lines.join("\r\n") + "\r\n";
  const datFilename = `${tinMain}${tinBranch}${lastMonthPadded}${yearStr}1701Q.DAT`;

  // ── HTML print report ──
  const tableRows = Array.from(payorMap.entries()).map(([payorTin, p], i) => {
    const payorTinFmt = payorTin.length >= SAWT_SCHEMA.TIN_MAIN_LENGTH
      ? `${payorTin.substring(0,3)}-${payorTin.substring(3,6)}-${payorTin.substring(6,9)}-0000`
      : payorTin;
    const rate = p.income > 0 ? (p.tax / p.income * 100).toFixed(2) : SAWT_SCHEMA.DEFAULT_RATE.toFixed(2);
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${payorTinFmt}</td>
      <td style="text-align:center">${p.atc}</td>
      <td style="text-align:center">${rate}</td>
      <td>${p.payorName}</td>
      <td style="text-align:right">${fmtPeso(p.income)}</td>
      <td style="text-align:right">${fmtPeso(p.tax)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>SAWT - ${fullName}</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; }
  .header { text-align: center; margin-bottom: 6px; }
  .header h2 { font-size: 11pt; font-weight: bold; margin: 0; }
  .header h3 { font-size: 10pt; font-weight: bold; margin: 2px 0; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { border: 1px solid #000; padding: 4px 6px; text-align: center; background: #f0f0f0; font-size: 8pt; }
  td { border: 1px solid #000; padding: 3px 6px; }
  .total-row td { font-weight: bold; border-top: 2px solid #000; }
  .grand-total { margin-top: 8px; text-align: right; font-weight: bold; font-size: 9pt; border-top: 2px solid #000; padding-top: 4px; }
  .footer { margin-top: 16px; font-size: 8pt; }
</style>
</head><body>
<div class="header">
  <h2>BIR FORM 1701Q</h2>
  <h3>SUMMARY ALPHALIST OF WITHHOLDING TAXES (SAWT)</h3>
</div>
<div class="meta">
  <div><strong>PAYEE'S NAME:</strong> ${fullName}<br><strong>TIN:</strong> ${displayTin}</div>
  <div style="text-align:right"><strong>FOR THE MONTH OF ${monthName}, ${yearStr}</strong></div>
</div>
<table>
  <thead><tr>
    <th style="width:40px">SEQ.<br>NO.</th>
    <th style="width:120px">TAXPAYER<br>IDENTIFICATION<br>NUMBER (TIN)</th>
    <th style="width:50px">ATC</th>
    <th style="width:40px">RATE</th>
    <th>CORPORATION / INDIVIDUAL<br>(Registered Name)</th>
    <th style="width:110px">INCOME<br>PAYMENT</th>
    <th style="width:110px">AMOUNT OF TAX<br>WITHHELD</th>
  </tr></thead>
  <tbody>
    ${tableRows}
    <tr class="total-row">
      <td colspan="5" style="text-align:right">PAGE TOTAL</td>
      <td style="text-align:right">${fmtPeso(totalIncome)}</td>
      <td style="text-align:right">${fmtPeso(totalTax)}</td>
    </tr>
  </tbody>
</table>
<div class="grand-total">GRAND TOTAL &nbsp;&nbsp;&nbsp; ${fmtPeso(totalTax)}</div>
<div class="footer">END OF REPORT</div>
</body></html>`;

  return {
    datContent,
    datFilename,
    html,
    tinMain,
    tinBranch,
    displayTin,
    fullName,
    payorCount: payorMap.size,
    totalIncome,
    totalTax,
  };
}


// ── 8. FILE I/O HELPERS (browser-side only) ───────────────────────────────────
// These touch the browser filesystem — kept here so the page doesn't need to
// know about Blobs/URLs directly, but still separated from pure logic above.

export async function writeFileToDir(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  content: string,
  type: string
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([content], { type }));
  await writable.close();
}

export function fallbackDownload(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
