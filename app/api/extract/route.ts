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

const GENERIC_PROMPT = `Extract all key information from this document. Return a JSON object with fields like: document_type, date, amount, name, address, and any other relevant fields you find. Return only valid JSON, nothing else.`;

const BIR_2307_PROMPT = `This is a BIR Form 2307 (Certificate of Creditable Tax Withheld at Source). Extract the following fields precisely and return only valid JSON, nothing else.

CRITICAL TIN EXTRACTION RULES:
- TIN format is always: XXX-XXX-XXX-XXXXX (with trailing branch code digits)
- The last segment after the 3rd dash contains 4-5 digits (e.g. 0000, 00000)
- NEVER truncate the TIN - extract ALL digits including trailing zeros
- Example: if you see "760-570-253-0000" extract exactly "760-570-253-0000"
- Example: if you see "629-449-549-0000" extract exactly "629-449-549-0000"

{
  "document_type": "BIR Form 2307",
  "period_from": "(MM/DD/YYYY)",
  "period_to": "(MM/DD/YYYY)",
  "payee_name": "",
  "payee_last_name": "(last name / surname only)",
  "payee_first_name": "(first name only)",
  "payee_middle_name": "(middle name only)",
  "payee_tin": "(extract full TIN including all trailing zeros)",
  "payee_address": "",
  "payor_name": "",
  "payor_tin": "(extract full TIN including all trailing zeros)",
  "payor_address": "",
  "atc": "(e.g. WI120, WI157, WI158, WI160 — read from the ATC box on the form)",
  "month_1_income": null,
  "month_2_income": null,
  "month_3_income": null,
  "total_income": null,
  "total_tax_withheld": null
}
ATC EXTRACTION RULES:
- The ATC (Alphanumeric Tax Code) appears in a labeled box on the form, usually near the income/tax section
- Common values: WI157 (1%), WI120 (2%), WI158 (5%), WI160 (10%), WI161 (15%), WI385 (7.5%)
- ALWAYS extract this field — do NOT leave it blank or omit it
- If you cannot read it clearly, return your best guess based on the withholding rate
IMPORTANT: The income amount appears in only ONE of the three month columns:
- If amount is in "1st Month of the Quarter" column → put in month_1_income, leave others null
- If amount is in "2nd Month of the Quarter" column → put in month_2_income, leave others null
- If amount is in "3rd Month of the Quarter" column → put in month_3_income, leave others null
- total_tax_withheld is the "Tax Withheld for the Quarter" value
- All amounts should be numbers without commas`;

function is2307(filename: string): boolean {
  const name = filename.toLowerCase();
  return name.includes("2307") || name.includes("bir") || name.includes("certificate") || name.includes("creditable");
}

async function callClaudeWithText(text: string, prompt?: string): Promise<any> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `${prompt || `Extract all key information from this document content. Return a JSON object with fields like: document_type, date, amount, name, address, and any other relevant fields you find. Return only valid JSON, nothing else.`}\n\nDocument content:\n${text.slice(0, 8000)}`,
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

    const use2307Prompt = is2307(upload.file_name || "");
    const prompt = use2307Prompt ? BIR_2307_PROMPT : GENERIC_PROMPT;

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: finalMimeType as any, data: base64File },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });
      extractedText = message.content[0].type === "text" ? message.content[0].text : "";

    } else if (isPDF) {
      const base64File = fileBuffer.toString("base64");
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64File },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });
      extractedText = message.content[0].type === "text" ? message.content[0].text : "";

    } else if (isExcel) {
      const text = extractTextFromExcel(fileBuffer);
      extractedText = await callClaudeWithText(text, prompt);

    } else if (isCsv) {
      const text = extractTextFromCsv(fileBuffer);
      extractedText = await callClaudeWithText(text, prompt);

    } else if (isWord) {
      const text = await extractTextFromWord(fileBuffer);
      extractedText = await callClaudeWithText(text, prompt);

    } else if (isText) {
      const text = fileBuffer.toString("utf-8");
      extractedText = await callClaudeWithText(text, prompt);

    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    let extractedData;
    try {
      extractedData = JSON.parse(cleanJson(extractedText));
    } catch {
      extractedData = { raw: extractedText, parse_error: true };
    }

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

    // Auto-create client from 2307
    if (use2307Prompt && extractedData?.payee_tin && extractedData?.payee_name) {
      const cleanTin = extractedData.payee_tin.replace(/\s/g, "");
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("tin", cleanTin)
        .single();
      if (!existing) {
  await supabase.from("clients").insert({
    name: extractedData.payee_name,
    tin: cleanTin,
    last_name: extractedData.payee_last_name || null,
    first_name: extractedData.payee_first_name || null,
    middle_name: extractedData.payee_middle_name || null,
    address: extractedData.payee_address || null,
  });
}
    }

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}