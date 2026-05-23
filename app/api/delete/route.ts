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
      .select("id, r2_key, status, extracted_data")
      .in("id", ids);

    if (uploads) {
      for (const upload of uploads) {
        // Always delete from R2
        try {
          await r2.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: upload.r2_key,
          }));
        } catch {
          // R2 file may already be gone, continue
        }

        // Only delete Supabase record if not extracted (no useful data)
        const isExtracted = upload.status === "extracted" && upload.extracted_data !== null;
        if (!isExtracted) {
          await supabase.from("uploads").delete().eq("id", upload.id);
        } else {
  // Soft delete - keep record but hide from dashboard
  const { data, error } = await supabase
    .from("uploads")
    .update({ 
      r2_key: null,
      deleted_at: new Date().toISOString()
    })
    .eq("id", upload.id)
    .select();

  console.log("Soft delete result:", JSON.stringify({ data, error, id: upload.id }));
}
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}