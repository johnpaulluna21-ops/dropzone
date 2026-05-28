// modules/tax/mappers/from-2307.ts

import type { NormalizedIncomeRecord, IncomeConfidence } from "@/core/schemas/income-record"

interface Raw2307Extraction {
  client_id: string
  payor_name: string
  payor_tin: string
  gross_income: number
  tax_withheld: number
  atc: string | null
  quarter: 1 | 2 | 3 | 4
  year: number
  source_document_id: string
  confidence: IncomeConfidence
}

export function mapFrom2307(raw: Raw2307Extraction): NormalizedIncomeRecord {
  return {
    client_id: raw.client_id,
    period: {
      quarter: raw.quarter,
      year: raw.year,
    },
    payor_name: raw.payor_name,
    payor_tin: raw.payor_tin,
    gross_income: raw.gross_income,
    tax_withheld: raw.tax_withheld,
    atc: raw.atc,
    evidence_type: "BIR_2307",
    source_document_id: raw.source_document_id,
    confidence: raw.confidence,
  }
}
// Derives quarter (1-4) from period_from or period_to string (MM/DD/YYYY)
// Returns null if period is missing or unparseable — never guesses
export function deriveQuarterFromPeriod(
  period_from?: string | null,
  period_to?: string | null
): number | null {
  const raw = period_from || period_to;
  if (!raw) return null;

  const parts = raw.split("/");
  if (parts.length < 1) return null;

  const month = parseInt(parts[0], 10);
  if (isNaN(month) || month < 1 || month > 12) return null;

  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

export function deriveYearFromPeriod(
  period_from?: string | null,
  period_to?: string | null
): number | null {
  const raw = period_to || period_from;
  if (!raw) return null;

  const parts = raw.split("/");
  if (parts.length < 3) return null;

  const year = parseInt(parts[2], 10);
  if (isNaN(year) || year < 2000) return null;

  return year;
}