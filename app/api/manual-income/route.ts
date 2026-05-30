import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get("client_id")
  const quarter = searchParams.get("quarter")
  const year = searchParams.get("year")

  if (!client_id || !quarter || !year) {
    return NextResponse.json(
      { error: "client_id, quarter, and year are required" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("manual_income")
    .select("*")
    .eq("client_id", client_id)
    .eq("quarter", parseInt(quarter))
    .eq("year", parseInt(year))
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const {
    client_id, quarter, year, payor_name, payor_tin,
    gross_income, tax_withheld, atc, source_type, notes,
  } = body

  if (!client_id || !quarter || !year || !payor_name || gross_income === undefined) {
    return NextResponse.json(
      { error: "client_id, quarter, year, payor_name, and gross_income are required" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("manual_income")
    .insert({
      client_id,
      quarter,
      year,
      payor_name,
      payor_tin: payor_tin || null,
      gross_income,
      tax_withheld: tax_withheld || 0,
      atc: atc || null,
      source_type: source_type || "manual_entry",
      notes: notes || null,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("manual_income")
    .delete()
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}