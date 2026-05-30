import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { type ClientRecord } from "@/core/types/client";

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
  const supabase = createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const res = await fetch("/api/admin/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, user_id: user.id }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error("Error adding client: " + result.error);

  return result.data as ClientRecord;
}