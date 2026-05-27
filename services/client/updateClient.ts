/**
 * services/client/updateClient.ts
 *
 * Updates an existing client record and related data.
 * Handles: client fields, prior year credit, tax payments.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface UpdateClientInput {
  clientId: string;
  tax_type: "8%" | "graduated";
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  rdo_code: string | null;
  address: string | null;
  credit?: string;
  creditYear?: number;
  payments: { Q1: string; Q2: string; Q3: string };
  deletedPayments: number[];
  year: number;
}

export async function updateClient(input: UpdateClientInput): Promise<void> {
  // 1. Update core client fields
  await supabase
    .from("clients")
    .update({
      tax_type: input.tax_type,
      last_name: input.last_name,
      first_name: input.first_name,
      middle_name: input.middle_name,
      rdo_code: input.rdo_code,
      address: input.address,
    })
    .eq("id", input.clientId);

  // 2. Upsert prior year credit if provided
  if (input.credit) {
    const creditYear = input.creditYear ?? new Date().getFullYear() - 1;
    const { data: existing } = await supabase
      .from("prior_year_credits")
      .select("id")
      .eq("client_id", input.clientId)
      .eq("year", creditYear)
      .single();

    if (existing) {
      await supabase
        .from("prior_year_credits")
        .update({ excess_credit: parseFloat(input.credit) || 0 })
        .eq("id", existing.id);
    } else {
      await supabase.from("prior_year_credits").insert({
        client_id: input.clientId,
        year: creditYear,
        excess_credit: parseFloat(input.credit) || 0,
      });
    }
  }

  // 3. Delete removed payments
  for (const qNum of input.deletedPayments) {
    await supabase
      .from("tax_payments")
      .delete()
      .eq("client_id", input.clientId)
      .eq("year", input.year)
      .eq("quarter", qNum);
  }

  // 4. Upsert remaining payments
  for (const [q, amount] of Object.entries(input.payments)) {
    if (amount === "") continue;
    const qNum = parseInt(q.replace("Q", ""));
    if (input.deletedPayments.includes(qNum)) continue;
    const amountPaid = parseFloat(amount) || 0;

    const { data: existing } = await supabase
      .from("tax_payments")
      .select("id")
      .eq("client_id", input.clientId)
      .eq("year", input.year)
      .eq("quarter", qNum)
      .single();

    if (existing) {
      await supabase
        .from("tax_payments")
        .update({ amount_paid: amountPaid })
        .eq("id", existing.id);
    } else {
      await supabase.from("tax_payments").insert({
        client_id: input.clientId,
        year: input.year,
        quarter: qNum,
        amount_paid: amountPaid,
      });
    }
  }
}