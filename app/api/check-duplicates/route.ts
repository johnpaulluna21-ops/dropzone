import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { fileNames } = await request.json();
    if (!fileNames || fileNames.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }
    const { data } = await supabase
      .from("uploads")
      .select("file_name")
      .in("file_name", fileNames);
    const duplicates = (data || []).map((d: any) => d.file_name);
    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ duplicates: [] });
  }
}