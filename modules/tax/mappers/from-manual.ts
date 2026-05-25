// modules/tax/mappers/from-manual.ts

import type { NormalizedIncomeRecord } from "@/core/schemas/income-record"

interface ManualIncomeEntry {
  client_id: string
  payor_name: string
  gross_income: number
  quarter: 1 | 2 | 3 | 4
  year: number
}

export function mapFromManualEntry(
  entry: ManualIncomeEntry,
  source_document_id: string
): NormalizedIncomeRecord {
  return {
    client_id: entry.client_id,
    period: {
      quarter: entry.quarter,
      year: entry.year,
    },
    payor_name: entry.payor_name,
    payor_tin: null,
    gross_income: entry.gross_income,
    tax_withheld: 0,
    atc: null,
    evidence_type: "manual_entry",
    source_document_id,
    confidence: "manual",
  }
}