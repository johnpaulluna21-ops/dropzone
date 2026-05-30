// services/tax/fetchAnnualITR.ts
// Layer: Service Layer
// Problem: retrieves annual ITR record for a given client and year
// Called by: components/tax/AnnualITRComparison.tsx

import { createClient } from "@/lib/supabase/client"
const supabase = createClient()
import type { AnnualITRRecord } from "@/core/schemas/annual-itr"


export async function fetchAnnualITR(
  client_id: string,
  year: number
): Promise<AnnualITRRecord | null> {
  const { data, error } = await supabase
    .from("annual_itr_records")
    .select("*")
    .eq("client_id", client_id)
    .eq("year", year)
    .single()

  if (error || !data) return null

  return data as AnnualITRRecord
}