// modules/tax/computeQuarterlySummary.ts
// ─────────────────────────────────────────────────────────────
// Pure function — tax computation engine for 8% IT filers.
// No DB calls. No UI. No side effects.
// Same input → same output, every time.
// ─────────────────────────────────────────────────────────────

import { parseAmount } from "@/lib/sawt"

export interface ManualIncomeEntry {
  id: string
  client_id: string
  quarter: number
  year: number
  payor_name: string
  payor_tin: string | null
  gross_income: number
  tax_withheld: number
  source_type: string
  notes: string | null
}

export interface QuarterSummary {
  quarter: string          // "Q1" | "Q2" | "Q3" | "Q4"
  forms: number            // count of 2307s
  manualCount: number      // count of manual entries
  manualEntries: ManualIncomeEntry[]
  rawForms: any[]          // raw 2307 extracted forms

  // Schedule II — Income
  item47: number           // quarterly income (2307 + manual)
  item49: number           // same as item47
  item50: number           // previous quarters cumulative
  item51: number           // cumulative income
  item52: number           // exemption (250,000)
  item53: number           // taxable income
  item54: number           // tax due at 8%

  // Schedule III — Credits
  item55: number           // prior year credits
  item56: number           // previous quarter payments
  item57: number           // CWT from previous quarters
  item58: number           // CWT this quarter (2307 + manual)
  item62: number           // total credits
  item63: number           // tax payable / overpayment

  paid: number             // payment made this quarter
  isOverpayment: boolean
  isNoTaxDue: boolean
}

export interface QuarterlySummaryResult {
  quarters: QuarterSummary[]
  totalForms: number
  priorCredit: number
}

export interface ComputeQuarterlySummaryInput {
  forms2307ByQuarter: Record<string, any[]>   // Q1..Q4 → extracted forms
  manualByQuarter: Record<string, ManualIncomeEntry[]>  // Q1..Q4 → manual entries
  priorCredit: number
  paymentsByQuarter: Record<string, number>   // Q1..Q4 → amount paid
  totalForms: number
}

const EXEMPTION = 250_000
const TAX_RATE = 0.08

export function computeQuarterlySummary(
  input: ComputeQuarterlySummaryInput
): QuarterlySummaryResult {
  const {
    forms2307ByQuarter,
    manualByQuarter,
    priorCredit,
    paymentsByQuarter,
    totalForms,
  } = input

  let cumulativeIncome = 0
  let cumulativeCWT = 0
  let previousPaid = 0

  const quarters: QuarterSummary[] = []

  for (const q of ["Q1", "Q2", "Q3", "Q4"]) {
    const forms = forms2307ByQuarter[q] || []
    const manualEntries = manualByQuarter[q] || []

    // Income from 2307s
    const income2307 = forms.reduce(
      (sum: number, f: any) => sum + parseAmount(f?.total_income),
      0
    )

    // Income from manual entries
    const incomeManual = manualEntries.reduce(
      (sum, m) => sum + (m.gross_income || 0),
      0
    )

    const item47 = income2307 + incomeManual
    const item49 = item47
    const item50 = cumulativeIncome
    const item51 = item47 + item50
    const item52 = EXEMPTION
    const item53 = item51 - item52
    const item54 = Math.max(0, item53 * TAX_RATE)

    const item55 = priorCredit
    const item56 = previousPaid
    const item57 = cumulativeCWT

    // CWT from 2307s
    const cwt2307 = forms.reduce(
      (sum: number, f: any) => sum + parseAmount(f?.total_tax_withheld),
      0
    )

    // CWT from manual entries
    const cwtManual = manualEntries.reduce(
      (sum, m) => sum + (m.tax_withheld || 0),
      0
    )

    const item58 = cwt2307 + cwtManual
    const item62 = item55 + item56 + item57 + item58
    const item63 = item54 - item62

    const paid = paymentsByQuarter[q] || 0

    quarters.push({
      quarter: q,
      forms: forms.length,
      manualCount: manualEntries.length,
      manualEntries,
      rawForms: forms,
      item47, item49, item50, item51, item52, item53, item54,
      item55, item56, item57, item58, item62, item63,
      paid,
      isOverpayment: item63 < 0,
      isNoTaxDue: item54 === 0 && item63 <= 0,
    })

    cumulativeIncome = item51
    cumulativeCWT += item58
    previousPaid += paid
  }

  return { quarters, totalForms, priorCredit }
}