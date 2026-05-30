import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { first_name, middle_name, last_name, tin, user_id } = await request.json();

    if (!user_id || !first_name || !last_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Build display name in standard format: LAST, FIRST MIDDLE
    const nameParts = [first_name.trim()];
    if (middle_name?.trim()) nameParts.push(middle_name.trim());
    const fullName = `${last_name.trim().toUpperCase()}, ${nameParts.join(" ").toUpperCase()}`;

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert({
        name: fullName,
        first_name: first_name.trim().toUpperCase(),
        middle_name: middle_name?.trim().toUpperCase() || null,
        last_name: last_name.trim().toUpperCase(),
        tin: tin || null,
        tax_type: "8%",
        user_id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}