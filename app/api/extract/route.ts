/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET_NAME } from "../../../lib/r2";
import sharp from "sharp";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function cleanJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) return jsonMatch[1].trim();
  return text.trim();
}

async function compressImage(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const compressed = await sharp(buffer)
      .resize(1500, 1500, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { buffer: compressed, mimeType: "image/jpeg" };
  } catch {
    return { buffer, mimeType };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uploadId } = await request.json();

    const { data: upload, error } = await supabase
      .from("uploads")
      .select("*")
      .eq("id", uploadId)
      .single();

    if (error || !upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const r2Object = await r2.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: upload.r2_key,
      })
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of r2Object.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    let fileBuffer = Buffer.concat(chunks);
    const isImage = upload.file_type.startsWith("image/");
    const isPDF = upload.file_type === "application/pdf";

    let finalMimeType = upload.file_type;

    // Compress images over 1MB
    if (isImage && fileBuffer.length > 1024 * 1024) {
      const compressed = await compressImage(fileBuffer, upload.file_type);
      fileBuffer = compressed.buffer;
      finalMimeType = compressed.mimeType;
    }

    const base64File = fileBuffer.toString("base64");

    let message;

    if (isImage) {
      message = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: finalMimeType as any,
                  data: base64File,
                },
              },
              {
                type: "text",
                text: `Extract all key information from this document. Return a JSON object with fields like: document_type, date, amount, name, address, and any other relevant fields you find. Return only valid JSON, nothing else.`,
              },
            ],
          },
        ],
      });
    } else if (isPDF) {
      message = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64File,
                },
              },
              {
                type: "text",
                text: `Extract all key information from this document. Return a JSON object with fields like: document_type, date, amount, name, address, and any other relevant fields you find. Return only valid JSON, nothing else.`,
              },
            ],
          },
        ],
      });
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const extractedText = message.content[0].type === "text" ? message.content[0].text : "";

    let extractedData;
    try {
      extractedData = JSON.parse(cleanJson(extractedText));
    } catch {
      extractedData = { raw: extractedText, parse_error: true };
    }

    await supabase
      .from("uploads")
      .update({
        extracted_data: extractedData,
        extracted_at: new Date().toISOString(),
        status: "extracted",
      })
      .eq("id", uploadId);

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}