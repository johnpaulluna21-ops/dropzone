// services/manualIncome.ts
// ─────────────────────────────────────────────────────────────
// All Supabase DB calls related to manual income entries.
// No tax math. No UI. No side effects beyond DB reads/writes.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js"
import type { ManualIncomeEntry } from "@/modules/tax/computeQuarterlySummary"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Fetch all manual income entries for a client in a given year
// Returns entries grouped by quarter
export async function fetchManualIncomeByYear(
  clientId: string,
  year: number
): Promise<Record<string, ManualIncomeEntry[]>> {
  const { data, error } = await supabase
    .from("manual_income")
    .select("*")
    .eq("client_id", clientId)
    .eq("year", year)
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)

  const byQuarter: Record<string, ManualIncomeEntry[]> = {
    Q1: [], Q2: [], Q3: [], Q4: [],
  }

  ;(data || []).forEach((entry: ManualIncomeEntry) => {
    const key = `Q${entry.quarter}`
    if (byQuarter[key]) byQuarter[key].push(entry)
  })

  return byQuarter
}

// Save a new manual income entry
export async function saveManualIncome(entry: {
  client_id: string
  quarter: number
  year: number
  payor_name: string
  payor_tin?: string | null
  gross_income: number
  tax_withheld: number
  source_type: string
  notes?: string | null
}): Promise<ManualIncomeEntry> {
  const { data, error } = await supabase
    .from("manual_income")
    .insert(entry)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Delete a manual income entry
export async function deleteManualIncome(id: string): Promise<void> {
  const { error } = await supabase
    .from("manual_income")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}