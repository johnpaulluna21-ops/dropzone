/**
 * services/client/createClient.ts
 *
 * Creates a new client record in the database.
 * Optionally saves a prior year excess credit if provided.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { type ClientRecord } from "@/core/types/client";

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface CreateClientInput {
  name: string;
  tin: string | null;
  tax_type: "8%" | "graduated";
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  rdo_code: string | null;
  prior_year_credit?: number | null;
  credit_year?: number | null;
}

export async function createClient(
  input: CreateClientInput
): Promise<ClientRecord> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: input.name,
      tin: input.tin,
      tax_type: input.tax_type,
      last_name: input.last_name,
      first_name: input.first_name,
      middle_name: input.middle_name,
      rdo_code: input.rdo_code,
    })
    .select()
    .single();

  if (error) throw new Error("Error adding client: " + error.message);

  if (input.prior_year_credit && input.credit_year) {
    await supabase.from("prior_year_credits").insert({
      client_id: data.id,
      year: input.credit_year,
      excess_credit: input.prior_year_credit,
    });
  }

  return data as ClientRecord;
}