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

    console.log("Uploads to delete:", JSON.stringify(uploads));

    if (uploads) {
      for (const upload of uploads) {
        const isExtracted = upload.status === "extracted";

        console.log(`File ${upload.id}: status=${upload.status}, isExtracted=${isExtracted}`);

        // Always delete from R2
        try {
          await r2.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: upload.r2_key,
          }));
        } catch {
          // R2 file may already be gone, continue
        }

        if (isExtracted) {
          // Soft delete - keep record for tax data
          const { data, error } = await supabase
            .from("uploads")
            .update({ 
              r2_key: null,
              deleted_at: new Date().toISOString()
            })
            .eq("id", upload.id)
            .select();

          console.log("Soft delete result:", JSON.stringify({ data, error, id: upload.id }));
        } else {
          // Hard delete - no useful data to keep
          await supabase.from("uploads").delete().eq("id", upload.id);
          console.log("Hard deleted:", upload.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}