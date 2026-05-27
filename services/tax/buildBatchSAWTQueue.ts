/**
 * services/tax/buildBatchSAWTQueue.ts
 *
 * Builds the batch SAWT submission queue for a given quarter.
 * Pure service — no UI, no React, no state setters.
 *
 * Input:  clients, quarter, year
 * Output: structured queue + stats
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { parseExtractedData, type ExtractedForm } from "@/lib/sawt";
import { type ClientRecord } from "@/core/types/client";

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface BatchSAWTQueueItem {
  client: ClientRecord;
  forms: ExtractedForm[];
}

export interface BatchSAWTQueueResult {
  queue: BatchSAWTQueueItem[];
  stats: {
    total: number;
    byQuarter: Record<string, number>;
    clientsWithNoForms: ClientRecord[];
  };
}

export async function buildBatchSAWTQueue(
  clients: ClientRecord[],
  quarterStr: string,
  year: string
): Promise<BatchSAWTQueueResult> {
  const qNum = parseInt(quarterStr.replace("Q", ""));
  const startMonth = (qNum - 1) * 3 + 1;
  const endMonth = qNum * 3;

  // 1. Fetch all extracted uploads
  const { data: uploads } = await supabase
    .from("uploads")
    .select("*")
    .eq("status", "extracted");

  const allUploads = uploads || [];

  // 2. Filter to 8% clients only
  const eligible = clients.filter(
    (c) => !c.tax_type || c.tax_type === "8%"
  );

  const queue: BatchSAWTQueueItem[] = [];
  const clientsWithNoForms: ClientRecord[] = [];

  // 3. For each client, find their 2307s for the quarter
  for (const client of eligible) {
    const clientUploads = allUploads.filter((u) => {
      const d = parseExtractedData(u.extracted_data);
      return (
        d?.payee_tin?.replace(/\D/g, "").includes(
          client.tin?.replace(/\D/g, "") || "NOMATCH"
        ) ||
        d?.payee_name?.toLowerCase().includes(client.name.toLowerCase())
      );
    });

    // 4. Bucket into the correct quarter
    const qForms: ExtractedForm[] = [];
    clientUploads.forEach((u) => {
      const d = parseExtractedData(u.extracted_data);
      const period = d?.period_to || d?.period_from || "";
      const month = parseInt(period.split("/")[0]) || 0;
      if (month >= startMonth && month <= endMonth) {
        qForms.push(d);
      }
    });

    if (qForms.length > 0) {
      queue.push({ client, forms: qForms });
    } else {
      clientsWithNoForms.push(client);
    }
  }

  // 5. Build stats
  const byQuarter: Record<string, number> = {};
  byQuarter[quarterStr] = queue.length;

  return {
    queue,
    stats: {
      total: queue.length,
      byQuarter,
      clientsWithNoForms,
    },
  };
}