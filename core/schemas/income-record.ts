// core/schemas/income-record.ts

export type IncomeEvidenceType =
  | "BIR_2307"
  | "official_receipt"
  | "sales_invoice"
  | "bank_statement"
  | "manual_entry"

export type IncomeConfidence =
  | "verified"
  | "estimated"
  | "manual"

export interface NormalizedIncomeRecord {
  client_id: string
  period: {
    quarter: 1 | 2 | 3 | 4
    year: number
  }
  payor_name: string
  payor_tin: string | null
  gross_income: number
  tax_withheld: number
  atc: string | null
  evidence_type: IncomeEvidenceType
  source_document_id: string
  confidence: IncomeConfidence
}