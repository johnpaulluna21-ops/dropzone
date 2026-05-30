import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, tin, tax_type, last_name, first_name,
      middle_name, rdo_code, prior_year_credit,
      credit_year, user_id,
    } = body;

    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert({
        name, tin, tax_type, last_name,
        first_name, middle_name, rdo_code,
        user_id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (prior_year_credit && credit_year) {
      await supabaseAdmin.from("prior_year_credits").insert({
        client_id: data.id,
        year: credit_year,
        excess_credit: prior_year_credit,
        user_id,
      });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}