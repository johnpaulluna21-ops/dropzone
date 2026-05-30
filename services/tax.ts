// services/tax.ts
// ─────────────────────────────────────────────────────────────
// All Supabase DB calls related to tax computation.
// No tax math. No UI. No side effects beyond DB reads/writes.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/client"
const supabase = createClient()
import { parseExtractedData } from "@/lib/sawt"



export async function fetchClient2307s(clientTin: string, clientName: string) {
  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("status", "extracted")
  if (error) throw new Error(error.message)
  return (data || []).filter((u: any) => {
    const d = parseExtractedData(u.extracted_data)
    return (
      d?.payee_tin?.replace(/\D/g, "").includes(clientTin?.replace(/\D/g, "") || "NOMATCH") ||
      d?.payee_name?.toLowerCase().includes(clientName.toLowerCase())
    )
  })
}

export async function fetchPriorYearCredit(clientId: string, year: number) {
  const { data, error } = await supabase
    .from("prior_year_credits")
    .select("*")
    .eq("client_id", clientId)
    .eq("year", year - 1)
  if (error) throw new Error(error.message)
  return (data || []).reduce((sum: number, c: any) => sum + (c.excess_credit || 0), 0)
}

export async function fetchTaxPayments(clientId: string, year: number) {
  const { data, error } = await supabase
    .from("tax_payments")
    .select("*")
    .eq("client_id", clientId)
    .eq("year", year)
  if (error) throw new Error(error.message)
  const byQuarter: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  const payments = data || []
  payments.forEach((p: any) => {
    if (p.quarter === 1) byQuarter.Q1 = p.amount_paid || 0
    if (p.quarter === 2) byQuarter.Q2 = p.amount_paid || 0
    if (p.quarter === 3) byQuarter.Q3 = p.amount_paid || 0
    if (p.quarter === 4) byQuarter.Q4 = p.amount_paid || 0
  })
  return byQuarter
}

export async function fetchSubmissions(clientId: string, year: number) {
  const { data, error } = await supabase
    .from("sawt_submissions")
    .select("*")
    .eq("client_id", clientId)
    .eq("year", year)
  if (error) throw new Error(error.message)
  const map: Record<string, string> = {}
  ;(data || []).forEach((s: any) => {
    map[`Q${s.quarter}`] = s.submitted_at
  })
  return map
}

export async function recordSawtSubmission(
  clientId: string,
  quarter: number,
  year: number,
  datFilename: string
) {
  const { error } = await supabase.from("sawt_submissions").insert({
    client_id: clientId,
    quarter,
    year,
    submitted_at: new Date().toISOString(),
    dat_filename: datFilename,
  })
  if (error) throw new Error(error.message)
}

export async function fetchClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name")
  if (error) throw new Error(error.message)
  return data || []
}

export async function fetchClientAITR(clientId: string, year: number) {
  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("document_type", "1701A")
    .eq("status", "extracted")
    .order("created_at", { ascending: false })
  if (error || !data || data.length === 0) return null
  const match = data.find((u: any) => {
    try {
      const extracted = typeof u.extracted_data === "string"
        ? JSON.parse(u.extracted_data)
        : u.extracted_data
      return extracted?.tax_year === year
    } catch {
      return false
    }
  })
  return match ?? null
}