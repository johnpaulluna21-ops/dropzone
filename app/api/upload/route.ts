import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    // Check for duplicate filename
    const { data: existing } = await supabase
      .from("uploads")
      .select("id")
      .eq("file_name", file.name)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ 
        error: "duplicate", 
        message: `${file.name} has already been uploaded.` 
      }, { status: 409 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileId = uuidv4();
    const r2Key = `uploads/${fileId}-${file.name}`;

    await r2.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: r2Key,
      Body: buffer,
      ContentType: file.type,
    }));

    await supabase.from("uploads").insert({
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      r2_key: r2Key,
      status: "pending",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}