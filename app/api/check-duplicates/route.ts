import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ duplicates: [] });

    const { fileNames } = await request.json();
    if (!fileNames || fileNames.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    const { data } = await supabase
      .from("uploads")
      .select("file_name")
      .in("file_name", fileNames)
      .eq("user_id", user.id);

    const duplicates = (data || []).map((d: { file_name: string }) => d.file_name);
    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ duplicates: [] });
  }
}