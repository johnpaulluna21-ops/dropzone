import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET_NAME } from "../../../lib/r2";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
    }

    const { data: uploads } = await supabase
      .from("uploads")
      .select("id, r2_key")
      .in("id", ids);

    if (uploads) {
      for (const upload of uploads) {
        await r2.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: upload.r2_key,
        }));
      }
    }

    await supabase.from("uploads").delete().in("id", ids);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}