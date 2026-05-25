// services/tax.ts
// ─────────────────────────────────────────────────────────────
// All Supabase DB calls related to tax computation.
// No tax math. No UI. No side effects beyond DB reads/writes.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js"
import { parseExtractedData } from "@/lib/sawt"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Fetch all extracted uploads that belong to a client
export async function fetchClient2307s(clientTin: string, clientName: string) {
  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("status", "extracted")
  if (error) throw new Error(error.message)

  const uploads = data || []
  return uploads.filter((u: any) => {
    const d = parseExtractedData(u.extracted_data)
    return (
      d?.payee_tin?.replace(/\D/g, "").includes(clientTin?.replace(/\D/g, "") || "NOMATCH") ||
      d?.payee_name?.toLowerCase().includes(clientName.toLowerCase())
    )
  })
}

// Fetch prior year credits for a client
export async function fetchPriorYearCredit(clientId: string, year: number) {
  const { data, error } = await supabase
    .from("prior_year_credits")
    .select("*")
    .eq("client_id", clientId)
    .eq("year", year - 1)
  if (error) throw new Error(error.message)
  const credits = data || []
  return credits.reduce((sum: number, c: any) => sum + (c.excess_credit || 0), 0)
}

// Fetch tax payments made for a client in a given year
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
    byQuarter[`Q${p.quarter}`] = p.amount_paid || 0
  })
  return byQuarter
}

// Fetch SAWT submission status for a client in a given year
export async function fetchSubmissions(clientId: string, year: number) {
  const { data, error } = await supabase
    .from("sawt_submissions")
    .select("quarter, submitted_at")
    .eq("client_id", clientId)
    .eq("year", year)
  if (error) throw new Error(error.message)

  const map: Record<string, string> = {}
  const submissions = data || []
  submissions.forEach((s: any) => {
    map[`Q${s.quarter}`] = s.submitted_at
  })
  return map
}

// Record a SAWT submission
export async function recordSawtSubmission(
  clientId: string,
  quarter: number,
  year: number,
  datFilename: string
) {
  const { error } = await supabase
    .from("sawt_submissions")
    .upsert({
      client_id: clientId,
      quarter,
      year,
      submitted_at: new Date().toISOString(),
      dat_filename: datFilename,
    }, { onConflict: "client_id,quarter,year" })
  if (error) throw new Error(error.message)
}

// Fetch all clients
export async function fetchClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name")
  if (error) throw new Error(error.message)
  return data || []
}
