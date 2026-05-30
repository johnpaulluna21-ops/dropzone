// services/tax/saveAnnualITR.ts
// Layer: Service Layer
// Problem: writes extracted 1701A data to annual_itr_records table
// Called by: app/api/extract/route.ts after successful 1701A extraction

import { createClient } from "@/lib/supabase/client"
const supabase = createClient()
import type { AnnualITRRecord } from "@/core/schemas/annual-itr"


export async function saveAnnualITR(record: AnnualITRRecord): Promise<{ id: string } | null> {
  // Check if a record already exists for this client + year
  const { data: existing } = await supabase
    .from("annual_itr_records")
    .select("id")
    .eq("client_id", record.client_id)
    .eq("year", record.year)
    .single()

  if (existing) {
    // Update existing record — re-upload replaces previous extraction
    const { data, error } = await supabase
      .from("annual_itr_records")
      .update({
        ...record,
        extracted_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single()

    if (error) {
      console.error("saveAnnualITR update error:", error)
      return null
    }

    return data
  }

  // Insert new record
  const { data, error } = await supabase
    .from("annual_itr_records")
    .insert({
      ...record,
      extracted_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) {
    console.error("saveAnnualITR insert error:", error)
    return null
  }

  return data
}