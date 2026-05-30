import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET_NAME } from "../../../lib/r2";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        const isExtracted = upload.status === "extracted";

        try {
          await r2.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: upload.r2_key,
          }));
        } catch {
          // R2 file may already be gone, continue
        }

        if (isExtracted) {
          await supabase
            .from("uploads")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", upload.id);
        } else {
          await supabase.from("uploads").delete().eq("id", upload.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}