/**
 * services/client/fetchClientEditData.ts
 *
 * Fetches all data needed to populate the client edit drawer.
 * Replaces the raw Supabase calls inside openEdit() in the tax page.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ClientEditData {
  priorYearCredit: string;
  payments: { Q1: string; Q2: string; Q3: string };
}

export async function fetchClientEditData(
  clientId: string,
  year: number
): Promise<ClientEditData> {
  // 1. Fetch prior year credit
  const creditYear = new Date().getFullYear() - 1;
  const { data: existingCredit } = await supabase
    .from("prior_year_credits")
    .select("excess_credit")
    .eq("client_id", clientId)
    .eq("year", creditYear)
    .single();

  // 2. Fetch tax payments for the year
  const { data: existingPayments } = await supabase
    .from("tax_payments")
    .select("quarter, amount_paid")
    .eq("client_id", clientId)
    .eq("year", year);

  const payments = { Q1: "", Q2: "", Q3: "" };
  (existingPayments || []).forEach((pay: any) => {
    if (pay.quarter === 1) payments.Q1 = pay.amount_paid?.toString() || "";
    if (pay.quarter === 2) payments.Q2 = pay.amount_paid?.toString() || "";
    if (pay.quarter === 3) payments.Q3 = pay.amount_paid?.toString() || "";
  });

  return {
    priorYearCredit: existingCredit?.excess_credit?.toString() || "",
    payments,
  };
}