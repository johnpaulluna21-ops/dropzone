// core/schemas/annual-itr.ts

export type AnnualITRTaxRateType = "8%" | "graduated"

export interface AnnualITRRecord {
  id?: string
  client_id: string
  year: number
  tax_rate_type: AnnualITRTaxRateType
  atc: string | null
  rdo_code: string | null

  // Part II
  tax_due: number
  total_credits: number
  tax_payable_overpayment: number

  // Part IV.B (8% filers)
  gross_sales: number
  sales_returns: number
  net_sales: number
  total_taxable_income: number
  allowable_deduction: number
  taxable_income_loss: number

  // Part IV.C (credits breakdown)
  prior_year_excess_credits: number
  quarterly_payments: number
  cwt_q1_q3: number
  cwt_q4: number

  // Part IV.A (graduated filers)
  graduated_net_sales: number
  graduated_osd: number
  graduated_net_income: number
  graduated_total_taxable_income: number

  // Metadata
  upload_id?: string | null
  confidence: string
  extracted_at?: string | null
  created_at?: string
}

export interface AnnualITRComparison {
  current: AnnualITRRecord
  prior: AnnualITRRecord | null
}