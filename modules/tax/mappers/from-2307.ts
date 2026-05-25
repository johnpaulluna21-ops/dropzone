// modules/tax/mappers/from-2307.ts

import type { NormalizedIncomeRecord } from "@/core/schemas/income-record"

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
  confidence: "verified" | "estimated"
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