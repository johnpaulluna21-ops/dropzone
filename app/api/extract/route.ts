/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET_NAME } from "../../../lib/r2";
import sharp from "sharp";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

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
    const compressed = await sharp(Buffer.from(buffer))
      .resize(1500, 1500, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { buffer: Buffer.from(compressed), mimeType: "image/jpeg" };
  } catch {
    return { buffer, mimeType };
  }
}

function extractTextFromExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  workbook.SheetNames.forEach((sheetName) => {
    lines.push(`Sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    lines.push(csv);
  });
  return lines.join("\n");
}

function extractTextFromCsv(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

async function extractTextFromWord(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function callClaudeWithText(text: string): Promise<any> {
  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Extract all key information from this document content. Return a JSON object with fields like: document_type, date, amount, name, address, and any other relevant fields you find. Return only valid JSON, nothing else.\n\nDocument content:\n${text.slice(0, 8000)}`,
      },
    ],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
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
    let fileBuffer: Buffer = Buffer.concat(chunks);

    const isImage = upload.file_type.startsWith("image/");
    const isPDF = upload.file_type === "application/pdf";
    const isExcel = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"].includes(upload.file_type);
    const isCsv = upload.file_type === "text/csv" || upload.file_name?.endsWith(".csv");
    const isWord = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"].includes(upload.file_type);
    const isText = upload.file_type === "text/plain";

    let finalMimeType = upload.file_type;
    let extractedText = "";

    if (isImage) {
      if (fileBuffer.length > 1024 * 1024) {
        const compressed = await compressImage(fileBuffer, upload.file_type);
        fileBuffer = compressed.buffer;
        finalMimeType = compressed.mimeType;
      }
      const base64File = fileBuffer.toString("base64");
      const message = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: finalMimeType as any, data: base64File },
              },
              {
                type: "text",
                text: `Extract all key information from this document. Return a JSON object with fields like: document_type, date, amount, name, address, and any other relevant fields you find. Return only valid JSON, nothing else.`,
              },
            ],
          },
        ],
      });
      extractedText = message.content[0].type === "text" ? message.content[0].text : "";

    } else if (isPDF) {
      const base64File = fileBuffer.toString("base64");
      const message = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64File },
              },
              {
                type: "text",
                text: `Extract all key information from this document. Return a JSON object with fields like: document_type, date, amount, name, address, and any other relevant fields you find. Return only valid JSON, nothing else.`,
              },
            ],
          },
        ],
      });
      extractedText = message.content[0].type === "text" ? message.content[0].text : "";

    } else if (isExcel) {
      const text = extractTextFromExcel(fileBuffer);
      extractedText = await callClaudeWithText(text);

    } else if (isCsv) {
      const text = extractTextFromCsv(fileBuffer);
      extractedText = await callClaudeWithText(text);

    } else if (isWord) {
      const text = await extractTextFromWord(fileBuffer);
      extractedText = await callClaudeWithText(text);

    } else if (isText) {
      const text = fileBuffer.toString("utf-8");
      extractedText = await callClaudeWithText(text);

    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    let extractedData;
    try {
      extractedData = JSON.parse(cleanJson(extractedText));
    } catch {
      extractedData = { raw: extractedText, parse_error: true };
    }

    // Auto-save document_type to its own column
    const documentType = extractedData?.document_type || null;

    await supabase
      .from("uploads")
      .update({
        extracted_data: extractedData,
        extracted_at: new Date().toISOString(),
        status: "extracted",
        ...(documentType && { document_type: documentType }),
      })
      .eq("id", uploadId);

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}