/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAGE_SIZE = 10;
const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

// ── DAT Validator helpers ────────────────────────────────────────────────────
function sqv(s: any): string { return (s || "").replace(/^"|"$/g, "").trim(); }
function isValidTin(t: string) { return /^\d{9}$/.test(t); }
function isValidBranch(t: string) { return /^\d{4}$/.test(t); }
function isValidAmount(a: string) { return /^\d+(\.\d{1,2})?$/.test(String(a)) && !isNaN(parseFloat(a)); }
function parsePeriod(p: string) { const m = (p || "").match(/^(\d{2})\/(\d{4})$/); return m ? { month: parseInt(m[1]), year: parseInt(m[2]) } : null; }
function hasSpecialChars(s: string) { return /[^A-Z0-9\s.,\-/()?&]/.test(s); }

function validateDAT(filename: string, raw: string) {
  const lines = raw.trim().split(/\r?\n/).filter((l: string) => l.trim() !== "");
  const lineResults: any[] = [];
  let hLine: any = null, cLine: any = null;
  const dLines: any[] = [];
  let errorCount = 0, warnCount = 0;
  const payorTinsSeen: Record<string, string> = {};

  lines.forEach((line: string, idx: number) => {
    const lineNum = String(idx + 1).padStart(10, "0");
    const fields = line.split(",");
    const type = fields[0];
    const errors: string[] = [], warnings: string[] = [];

    if (type === "HSAWT") {
      hLine = { idx, fields };
      if (fields.length < 10) { errors.push("H line must have at least 10 fields"); }
      else {
        if (fields[1] !== "H1701Q") errors.push(`Form code must be H1701Q, got "${fields[1]}"`);
        if (!isValidTin(fields[2])) errors.push(`TIN main must be exactly 9 digits, got "${fields[2]}"`);
        if (!isValidBranch(fields[3])) errors.push(`TIN branch must be exactly 4 digits, got "${fields[3]}"`);
        const period = parsePeriod(fields[8]);
        if (!period) { errors.push(`Period must be MM/YYYY format, got "${fields[8]}"`); }
        else if (![3,6,9,12].includes(period.month)) warnings.push(`Period month ${String(period.month).padStart(2,"0")} is not a quarter-end month (expected 03, 06, 09, or 12)`);
        if (!sqv(fields[9])) warnings.push("RDO code is blank");
        if (!sqv(fields[5])) errors.push("Last name is blank on H line");
        if (!sqv(fields[6])) errors.push("First name is blank on H line");
      }
    } else if (type === "DSAWT") {
      dLines.push({ idx, fields, lineNum });
      if (fields.length < 15) { errors.push("D line must have at least 15 fields"); }
      else {
        if (fields[1] !== "D1701Q") errors.push(`Form code must be D1701Q, got "${fields[1]}"`);
        const seq = parseInt(fields[2]);
        if (isNaN(seq)) errors.push(`Sequence number must be numeric, got "${fields[2]}"`);
        else if (seq !== dLines.length) errors.push(`Sequence number ${seq} is out of order — expected ${dLines.length}`);
        if (!isValidTin(fields[3])) { errors.push(`Payor TIN main must be exactly 9 digits, got "${fields[3]}"`); }
        else {
          if (payorTinsSeen[fields[3]]) errors.push(`Duplicate payor TIN ${fields[3]} — already appears on line ${payorTinsSeen[fields[3]]}`);
          else payorTinsSeen[fields[3]] = lineNum;
        }
        if (!isValidBranch(fields[4])) errors.push(`Payor TIN branch must be 4 digits, got "${fields[4]}"`);
        const payorName = sqv(fields[5]);
        if (!payorName) { errors.push("Payor name is blank"); }
        else {
          if (payorName !== payorName.toUpperCase()) errors.push(`Payor name must be uppercase: "${payorName}"`);
          if (hasSpecialChars(payorName)) warnings.push(`Payor name contains special characters that may cause rejection`);
          if (payorName.endsWith(".")) warnings.push(`Payor name ends with a period which BIR may reject`);
        }
        const dPeriod = parsePeriod(fields[9]);
        if (!dPeriod) { errors.push(`Period must be MM/YYYY format, got "${fields[9]}"`); }
        else if (hLine && fields[9] !== hLine.fields[8]) errors.push(`D line period ${fields[9]} does not match H line period ${hLine.fields[8]}`);
        if (!(fields[11] || "").trim()) errors.push("ATC is blank");
        const rate = parseFloat(fields[12]);
        if (isNaN(rate) || rate <= 0) errors.push(`Rate must be a positive number, got "${fields[12]}"`);
        const income = parseFloat(fields[13]);
        const tax = parseFloat(fields[14]);
        if (!isValidAmount(fields[13])) errors.push(`Income must be a valid amount, got "${fields[13]}"`);
        if (!isValidAmount(fields[14])) errors.push(`Tax withheld must be a valid amount, got "${fields[14]}"`);
        if (isValidAmount(fields[13]) && isValidAmount(fields[14])) {
          if (tax === 0) errors.push("Tax withheld is ₱0.00 — a D line with zero tax is invalid");
          else if (!isNaN(rate) && rate > 0) {
            const expected = income * (rate / 100);
            const diff = Math.abs(expected - tax);
            if (diff > 0.10) warnings.push(`Rate (${rate}%) × income (${income.toFixed(2)}) = ${expected.toFixed(2)} but tax withheld is ${tax.toFixed(2)} — difference of ₱${diff.toFixed(2)}`);
          }
        }
      }
    } else if (type === "CSAWT") {
      cLine = { idx, fields };
      if (fields.length < 7) { errors.push("C line must have at least 7 fields"); }
      else {
        if (fields[1] !== "C1701Q") errors.push(`Form code must be C1701Q, got "${fields[1]}"`);
        if (!isValidTin(fields[2])) errors.push("TIN main must be exactly 9 digits");
        if (!isValidBranch(fields[3])) errors.push("TIN branch must be exactly 4 digits");
        if (!parsePeriod(fields[4])) errors.push(`Period must be MM/YYYY format, got "${fields[4]}"`);
        if (!isValidAmount(fields[5])) errors.push("Total income is not a valid amount");
        if (!isValidAmount(fields[6])) errors.push("Total tax withheld is not a valid amount");
      }
    } else {
      errors.push(`Unknown record type "${type}" — expected HSAWT, DSAWT, or CSAWT`);
    }

    errorCount += errors.length;
    warnCount += warnings.length;
    lineResults.push({ lineNum, type: type.replace("SAWT", ""), line, errors, warnings });
  });

  const structErrors: string[] = [];
  if (!hLine) structErrors.push("Missing H (header) record — file must start with HSAWT line");
  if (!cLine) structErrors.push("Missing C (control total) record — file must end with CSAWT line");
  if (dLines.length === 0) structErrors.push("No D (detail) records found — at least one DSAWT line required");
  if (hLine && cLine && hLine.idx > cLine.idx) structErrors.push("H record must appear before C record");
  if (cLine && dLines.some((d: any) => d.idx > cLine.idx)) structErrors.push("All D records must appear before the C record");
  if (hLine && cLine && dLines.length > 0) {
    const cIncome = parseFloat(cLine.fields[5]) || 0;
    const cTax = parseFloat(cLine.fields[6]) || 0;
    const sumIncome = dLines.reduce((s: number, d: any) => s + (parseFloat(d.fields[13]) || 0), 0);
    const sumTax = dLines.reduce((s: number, d: any) => s + (parseFloat(d.fields[14]) || 0), 0);
    if (Math.abs(cIncome - sumIncome) > 0.05) structErrors.push(`C total income ${cIncome.toFixed(2)} ≠ sum of D lines ${sumIncome.toFixed(2)} — difference of ₱${Math.abs(cIncome - sumIncome).toFixed(2)}`);
    if (Math.abs(cTax - sumTax) > 0.05) structErrors.push(`C total tax ${cTax.toFixed(2)} ≠ sum of D lines ${sumTax.toFixed(2)} — difference of ₱${Math.abs(cTax - sumTax).toFixed(2)}`);
    if (hLine.fields[2] !== cLine.fields[2]) structErrors.push(`TIN mismatch: H line has ${hLine.fields[2]}, C line has ${cLine.fields[2]}`);
    if (hLine.fields[8] !== cLine.fields[4]) structErrors.push(`Period mismatch: H line has ${hLine.fields[8]}, C line has ${cLine.fields[4]}`);
  }
  errorCount += structErrors.length;

  const hInfo = hLine ? {
    tin: `${hLine.fields[2]}-${hLine.fields[3]}`,
    name: [sqv(hLine.fields[5]||""), sqv(hLine.fields[6]||""), sqv(hLine.fields[7]||"")].filter(Boolean).join(", "),
    period: hLine.fields[8],
    rdo: sqv(hLine.fields[9]||""),
    dCount: dLines.length,
  } : null;

  let txtReport = "";
  if (hInfo) {
    txtReport += `TIN of Withholding Agent TIN: ${hInfo.tin}\nAlphalist Form              : 1701Q\nTaxable Month               : ${hInfo.period}\n\n`;
  }
  txtReport += `LINE NUM       SCHEDULE     ERROR DESCRIPTION\n----------     --------     ------------------------------------------------------------\n`;
  if (errorCount === 0 && warnCount === 0) {
    txtReport += `0000000000                  No Errors Encountered\n`;
  } else {
    structErrors.forEach((e: string) => { txtReport += `0000000000     STRUCT       ${e}\n`; });
    lineResults.forEach((r: any) => {
      r.errors.forEach((e: string) => { txtReport += `${r.lineNum}     ${r.type.padEnd(8)} ${e}\n`; });
      r.warnings.forEach((w: string) => { txtReport += `${r.lineNum}     ${r.type.padEnd(8)} [WARN] ${w}\n`; });
    });
  }
  txtReport += `----------     --------     ------------------------------------------------------------\n`;

  return { filename, hInfo, lineResults, structErrors, errorCount, warnCount, txtReport, passed: errorCount === 0 };
}

// ── DAT Validator Modal ──────────────────────────────────────────────────────
function DATValidatorModal({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const processFiles = (files: File[]) => {
    const datFiles = files.filter(f => /\.(dat|txt)$/i.test(f.name));
    if (!datFiles.length) return;
    let loaded = 0;
    const newResults: any[] = [];
    datFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newResults.push({ filename: file.name, content: ev.target?.result as string });
        loaded++;
        if (loaded === datFiles.length) {
          newResults.sort((a, b) => a.filename.localeCompare(b.filename));
          setResults(prev => [...prev, ...newResults.map(r => validateDAT(r.filename, r.content))]);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    processFiles(Array.from(e.dataTransfer.files));
  };

  const downloadTxt = (r: any) => {
    const blob = new Blob([r.txtReport], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename.replace(/\.(dat|txt)$/i, "") + ".TXT";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyTxt = (txt: string) => { navigator.clipboard.writeText(txt).catch(() => {}); };

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 760, background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: "rgba(16,185,129,0.15)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-shield-check" style={{ fontSize: 16, color: "#6ee7b7" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>DAT File Validator</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>BIR SAWT 1701Q — single or batch</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>✕</button>
        </div>

        <div style={{ padding: "20px" }}>
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: "1.5px dashed rgba(255,255,255,0.12)", borderRadius: 14, padding: "1.5rem", textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.02)", marginBottom: 16 }}
          >
            <i className="ti ti-files" style={{ fontSize: 28, color: "rgba(255,255,255,0.2)" }} />
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>Drop .DAT files here or click to browse</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>Single or multiple files accepted</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".dat,.DAT,.txt,.TXT" multiple style={{ display: "none" }} onChange={e => { processFiles(Array.from(e.target.files || [])); if (fileInputRef.current) fileInputRef.current.value = ""; }} />

          {/* Master bar */}
          {total > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, marginBottom: 14, background: passed === total ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `0.5px solid ${passed === total ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i className={`ti ti-${passed === total ? "circle-check" : "alert-circle"}`} style={{ fontSize: 16, color: passed === total ? "#6ee7b7" : "#fca5a5" }} />
                <p style={{ fontSize: 13, fontWeight: 500, color: passed === total ? "#6ee7b7" : "#fca5a5" }}>{passed} of {total} file{total !== 1 ? "s" : ""} passed validation</p>
              </div>
              <button onClick={() => setResults([])} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                <i className="ti ti-trash" style={{ fontSize: 12 }} /> Clear all
              </button>
            </div>
          )}

          {/* File cards */}
          {results.map((r, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
              {/* Card header */}
              <div onClick={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: r.passed ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.1)", flexShrink: 0 }}>
                  <i className={`ti ti-${r.passed ? "check" : "x"}`} style={{ fontSize: 13, color: r.passed ? "#6ee7b7" : "#fca5a5" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.filename}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{r.hInfo ? `${r.hInfo.tin} · ${r.hInfo.name || "—"} · ${r.hInfo.period} · ${r.hInfo.dCount} 2307s` : "Could not parse header"}</p>
                </div>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500, flexShrink: 0, background: !r.passed ? "rgba(239,68,68,0.12)" : r.warnCount > 0 ? "rgba(251,191,36,0.12)" : "rgba(16,185,129,0.12)", color: !r.passed ? "#fca5a5" : r.warnCount > 0 ? "#fcd34d" : "#6ee7b7" }}>
                  {!r.passed ? `${r.errorCount} error${r.errorCount !== 1 ? "s" : ""}` : r.warnCount > 0 ? `Passed · ${r.warnCount} warning${r.warnCount !== 1 ? "s" : ""}` : "Passed"}
                </span>
                <i className={`ti ti-chevron-${expanded[i] ? "up" : "down"}`} style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
              </div>

              {/* Expanded detail */}
              {expanded[i] && (
                <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", padding: "14px" }}>
                  {/* Meta */}
                  {r.hInfo && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
                      {[["TIN", r.hInfo.tin], ["Name", r.hInfo.name || "—"], ["Period", r.hInfo.period], ["RDO", r.hInfo.rdo || "—"], ["2307s", r.hInfo.dCount]].map(([label, val]) => (
                        <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "7px 10px" }}>
                          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>{label}</p>
                          <p style={{ fontSize: 11, fontWeight: 500, color: "#fff", wordBreak: "break-all" }}>{val}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Structure errors */}
                  {r.structErrors.length > 0 && (
                    <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#fca5a5", marginBottom: 4 }}><i className="ti ti-alert-triangle" style={{ fontSize: 12 }} /> Structure errors</p>
                      {r.structErrors.map((e: string, j: number) => <p key={j} style={{ fontSize: 11, color: "#fca5a5", marginTop: 3 }}>· {e}</p>)}
                    </div>
                  )}

                  {/* Line table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12 }}>
                    <thead>
                      <tr>
                        {["Line", "Type", "Status"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {r.lineResults.map((l: any, j: number) => (
                        <tr key={j}>
                          <td style={{ padding: "5px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", fontFamily: "monospace", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{l.lineNum}</td>
                          <td style={{ padding: "5px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", fontWeight: 500, color: "#fff", fontSize: 11 }}>{l.type}</td>
                          <td style={{ padding: "5px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                            {l.errors.length === 0 && l.warnings.length === 0 && <span style={{ fontSize: 10, color: "#6ee7b7" }}>● OK</span>}
                            {l.errors.length > 0 && <>
                              <span style={{ fontSize: 10, color: "#fca5a5" }}>● Error</span>
                              {l.errors.map((e: string, k: number) => <div key={k} style={{ fontSize: 10, color: "#fca5a5", marginTop: 2 }}>· {e}</div>)}
                            </>}
                            {l.warnings.length > 0 && <>
                              {l.errors.length === 0 && <span style={{ fontSize: 10, color: "#fcd34d" }}>● Warning</span>}
                              {l.warnings.map((w: string, k: number) => <div key={k} style={{ fontSize: 10, color: "#fcd34d", marginTop: 2 }}>⚠ {w}</div>)}
                            </>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* BIR report */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>BIR-style validation report</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => copyTxt(r.txtReport)} style={{ ...inputStyle, width: "auto", padding: "3px 10px", fontSize: 11, cursor: "pointer" }}><i className="ti ti-copy" style={{ fontSize: 11 }} /> Copy</button>
                      <button onClick={() => downloadTxt(r)} style={{ ...inputStyle, width: "auto", padding: "3px 10px", fontSize: 11, cursor: "pointer" }}><i className="ti ti-download" style={{ fontSize: 11 }} /> Download .TXT</button>
                    </div>
                  </div>
                  <pre style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: 8, overflowX: "auto", lineHeight: 1.6, whiteSpace: "pre" }}>{r.txtReport}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ── Batch SAWT Confirmation Modal ────────────────────────────────────────────
function BatchSAWTModal({ quarter, yearStr, clientsWithForms, onClose, onConfirm }: {
  quarter: string;
  yearStr: string;
  clientsWithForms: { client: any; forms: any[] }[];
  onClose: () => void;
  onConfirm: (selected: { client: any; forms: any[] }[], quarter: string) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    clientsWithForms.forEach(c => { init[c.client.id] = true; });
    return init;
  });
  const selectedCount = Object.values(checked).filter(Boolean).length;
  const selectedClients = clientsWithForms.filter(c => checked[c.client.id]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-files" style={{ fontSize: 16, color: "#a5b4fc" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Batch Generate SAWT</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{quarter} {yearStr} — select clients to include</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>✕</button>
        </div>
        <div style={{ padding: "10px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{selectedCount} of {clientsWithForms.length} clients selected</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { const all: Record<string, boolean> = {}; clientsWithForms.forEach(c => { all[c.client.id] = true; }); setChecked(all); }} style={{ padding: "3px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Select All</button>
            <button onClick={() => { const none: Record<string, boolean> = {}; clientsWithForms.forEach(c => { none[c.client.id] = false; }); setChecked(none); }} style={{ padding: "3px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>None</button>
          </div>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", padding: "8px 0" }}>
          {clientsWithForms.length === 0 ? (
            <p style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>No clients have 2307s for {quarter} {yearStr}.</p>
          ) : clientsWithForms.map(({ client, forms }) => (
            <div key={client.id} onClick={() => setChecked(prev => ({ ...prev, [client.id]: !prev[client.id] }))} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer", background: checked[client.id] ? "rgba(99,102,241,0.06)" : "transparent", borderBottom: "0.5px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${checked[client.id] ? "#6366f1" : "rgba(255,255,255,0.2)"}`, background: checked[client.id] ? "#6366f1" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                {checked[client.id] && <i className="ti ti-check" style={{ fontSize: 11, color: "#fff" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{client.tin || "No TIN"} · {forms.length} 2307{forms.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 20px", borderTop: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            Will generate: <span style={{ color: "#a5b4fc", fontWeight: 600 }}>{selectedCount} DAT file{selectedCount !== 1 ? "s" : ""}</span>, <span style={{ color: "#a5b4fc", fontWeight: 600 }}>{selectedCount} PDF{selectedCount !== 1 ? "s" : ""}</span>, 1 summary TXT
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={() => selectedCount > 0 && onConfirm(selectedClients, quarter)} disabled={selectedCount === 0} style={{ padding: "8px 16px", background: selectedCount > 0 ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, color: selectedCount > 0 ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 600, cursor: selectedCount > 0 ? "pointer" : "default", fontFamily: "inherit" }}>
              <i className="ti ti-file-download" style={{ fontSize: 13 }} /> Generate {selectedCount > 0 ? `(${selectedCount})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TaxPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTin, setNewTin] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newMiddleName, setNewMiddleName] = useState("");
  const [newRdo, setNewRdo] = useState("");
  const [newCredit, setNewCredit] = useState("");
  const [newTaxType, setNewTaxType] = useState<"8%" | "graduated">("8%");
  const [creditYear, setCreditYear] = useState(new Date().getFullYear().toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editCredit, setEditCredit] = useState("");
  const [editCreditYear, setEditCreditYear] = useState("");
  const [editTaxType, setEditTaxType] = useState<"8%" | "graduated">("8%");
  const [editLastName, setEditLastName] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editMiddleName, setEditMiddleName] = useState("");
  const [editRdo, setEditRdo] = useState("");
  const [editPayments, setEditPayments] = useState<{ Q1: string; Q2: string; Q3: string }>({ Q1: "", Q2: "", Q3: "" });
  const [deletedPayments, setDeletedPayments] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [page8, setPage8] = useState(1);
  const [pageGrad, setPageGrad] = useState(1);
  const [activeQuarter, setActiveQuarter] = useState("Q1");
  const [activeFolderTab, setActiveFolderTab] = useState<"8%" | "graduated">("8%");
  const [showValidator, setShowValidator] = useState(false);
  const [batchModal, setBatchModal] = useState<{ quarter: string; clientsWithForms: { client: any; forms: any[] }[] } | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);

  useEffect(() => { fetchClients(); }, []);
  useEffect(() => { setPage8(1); setPageGrad(1); }, [search]);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients(data || []);
  };

  const openEdit = async (client: any) => {
    setEditingClient(client);
    setEditTaxType(client.tax_type || "8%");
    setEditLastName(client.last_name || "");
    setEditFirstName(client.first_name || "");
    setEditMiddleName(client.middle_name || "");
    setEditRdo(client.rdo_code || "");
    setEditCreditYear((new Date().getFullYear() - 1).toString());
    setDeletedPayments([]);
    const { data: existingCredit } = await supabase
      .from("prior_year_credits").select("excess_credit")
      .eq("client_id", client.id)
      .eq("year", new Date().getFullYear() - 1)
      .single();
    setEditCredit(existingCredit?.excess_credit?.toString() || "");
    const { data: existingPayments } = await supabase
      .from("tax_payments").select("quarter, amount_paid")
      .eq("client_id", client.id)
      .eq("year", parseInt(year));
    const p = { Q1: "", Q2: "", Q3: "" };
    (existingPayments || []).forEach((pay: any) => {
      if (pay.quarter === 1) p.Q1 = pay.amount_paid?.toString() || "";
      if (pay.quarter === 2) p.Q2 = pay.amount_paid?.toString() || "";
      if (pay.quarter === 3) p.Q3 = pay.amount_paid?.toString() || "";
    });
    setEditPayments(p);
  };

  const clearPayment = useCallback((qNum: number) => {
    const qKey = `Q${qNum}` as "Q1" | "Q2" | "Q3";
    setEditPayments(prev => ({ ...prev, [qKey]: "" }));
    setDeletedPayments(prev => [...prev, qNum]);
  }, []);

  const addClient = async () => {
    if (!newName.trim()) return alert("Name is required");
    const { data, error } = await supabase.from("clients").insert({
      name: newName.trim(), tin: newTin.trim() || null, tax_type: newTaxType,
      last_name: newLastName.trim() || null, first_name: newFirstName.trim() || null,
      middle_name: newMiddleName.trim() || null, rdo_code: newRdo.trim() || null,
    }).select().single();
    if (error) return alert("Error adding client: " + error.message);
    if (newCredit && data) {
      await supabase.from("prior_year_credits").insert({ client_id: data.id, year: parseInt(creditYear), excess_credit: parseFloat(newCredit) || 0 });
    }
    setNewName(""); setNewTin(""); setNewCredit(""); setNewTaxType("8%");
    setNewLastName(""); setNewFirstName(""); setNewMiddleName(""); setNewRdo("");
    setShowAddClient(false);
    fetchClients();
  };

  const saveEditClient = useCallback(async () => {
    if (!editingClient) return;
    await supabase.from("clients").update({
      tax_type: editTaxType,
      last_name: editLastName.trim() || null,
      first_name: editFirstName.trim() || null,
      middle_name: editMiddleName.trim() || null,
      rdo_code: editRdo.trim() || null,
    }).eq("id", editingClient.id);
    if (editCredit) {
      const creditYearInt = parseInt(editCreditYear) || new Date().getFullYear() - 1;
      const { data: existing } = await supabase
        .from("prior_year_credits").select("id")
        .eq("client_id", editingClient.id).eq("year", creditYearInt).single();
      if (existing) {
        await supabase.from("prior_year_credits").update({ excess_credit: parseFloat(editCredit) || 0 }).eq("id", existing.id);
      } else {
        await supabase.from("prior_year_credits").insert({ client_id: editingClient.id, year: creditYearInt, excess_credit: parseFloat(editCredit) || 0 });
      }
    }
    for (const qNum of deletedPayments) {
      await supabase.from("tax_payments").delete()
        .eq("client_id", editingClient.id).eq("year", parseInt(year)).eq("quarter", qNum);
    }
    for (const [q, amount] of Object.entries(editPayments)) {
      if (amount === "") continue;
      const qNum = parseInt(q.replace("Q", ""));
      if (deletedPayments.includes(qNum)) continue;
      const amountPaid = parseFloat(amount) || 0;
      const { data: existing } = await supabase
        .from("tax_payments").select("id")
        .eq("client_id", editingClient.id).eq("year", parseInt(year)).eq("quarter", qNum).single();
      if (existing) {
        await supabase.from("tax_payments").update({ amount_paid: amountPaid }).eq("id", existing.id);
      } else {
        await supabase.from("tax_payments").insert({ client_id: editingClient.id, year: parseInt(year), quarter: qNum, amount_paid: amountPaid });
      }
    }
    const updatedClient = {
      ...editingClient,
      tax_type: editTaxType,
      last_name: editLastName.trim() || null,
      first_name: editFirstName.trim() || null,
      middle_name: editMiddleName.trim() || null,
      rdo_code: editRdo.trim() || null,
    };
    setEditingClient(null);
    setEditCredit("");
    setEditPayments({ Q1: "", Q2: "", Q3: "" });
    setDeletedPayments([]);
    fetchClients();
    if (selected?.id === editingClient.id) {
      setSelected(updatedClient);
      computeSummary(updatedClient);
    }
  }, [editingClient, editTaxType, editLastName, editFirstName, editMiddleName, editRdo, editCredit, editCreditYear, editPayments, deletedPayments, year, selected]);

  const generateSAWT = async (client: any, quarterNum: number, quarterForms: any[]) => {
    const tin = (client.tin || "").replace(/\D/g, "");
    const tinMain = tin.substring(0, 9).padEnd(9, "0");
    const tinBranch = tin.substring(9, 13).padEnd(4, "0");
    const lastName = client.last_name || "";
    const firstName = client.first_name || "";
    const middleName = client.middle_name || "";
    const rdo = client.rdo_code || "000";
    const lastMonth = quarterNum * 3;
    const lastMonthPadded = String(lastMonth).padStart(2, "0");
    const period = `${lastMonthPadded}/${year}`;
    const monthName = MONTHS[lastMonth - 1];
    const displayTin = `${tinMain.substring(0,3)}-${tinMain.substring(3,6)}-${tinMain.substring(6,9)}-${tinBranch}`;
    const fullName = `${lastName}, ${firstName} ${middleName}`.trim();
    const totalIncome = quarterForms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0), 0);
    const totalTax = quarterForms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0), 0);

    const lines: string[] = [];
    lines.push(`HSAWT,H1701Q,${tinMain},${tinBranch},"","${lastName}","${firstName}","${middleName}",${period},${rdo}`);
    quarterForms.forEach((f: any, i: number) => {
      const payorTin = (f?.atc_tin || f?.payor_tin || "").replace(/\D/g, "").substring(0, 9).padEnd(9, "0");
      const payorName = (f?.payor_name || f?.client_name || "").toUpperCase().replace(/"/g, "").replace(/\.$/, "").trim();
      const atc = f?.atc || "WI120";
      const income = parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0;
      const tax = parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0;
      const rate = income > 0 ? parseFloat((tax / income * 100).toFixed(2)) : 2.00;
      lines.push(`DSAWT,D1701Q,${i + 1},${payorTin},0000,"${payorName}",,,,${period},,${atc},${rate.toFixed(2)},${income.toFixed(2)},${tax.toFixed(2)}`);
    });
    lines.push(`CSAWT,C1701Q,${tinMain},${tinBranch},${period},${totalIncome.toFixed(2)},${totalTax.toFixed(2)}`);

    const datContent = lines.join("\r\n") + "\r\n";
    const datBlob = new Blob([datContent], { type: "text/plain" });
    const datUrl = URL.createObjectURL(datBlob);
    const datLink = document.createElement("a");
    datLink.href = datUrl;
    datLink.download = `${tinMain}${tinBranch}${lastMonthPadded}${year}1701Q.DAT`;
    datLink.click();
    URL.revokeObjectURL(datUrl);

    const fmtNum = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tableRows = quarterForms.map((f: any, i: number) => {
      const payorTinRaw = (f?.atc_tin || f?.payor_tin || "").replace(/\D/g, "");
      const payorTinFmt = payorTinRaw.length >= 9
        ? `${payorTinRaw.substring(0,3)}-${payorTinRaw.substring(3,6)}-${payorTinRaw.substring(6,9)}-${payorTinRaw.substring(9,13) || "0000"}`
        : payorTinRaw;
      const payorName = (f?.payor_name || f?.client_name || "").toUpperCase().replace(/\.$/, "").trim();
      const atc = f?.atc || "WI120";
      const income = parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0;
      const tax = parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0;
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${payorTinFmt}</td>
        <td style="text-align:center">${atc}</td>
        <td style="text-align:center">${income > 0 ? (tax / income * 100).toFixed(2) : "2.00"}</td>
        <td>${payorName}</td>
        <td style="text-align:right">${fmtNum(income)}</td>
        <td style="text-align:right">${fmtNum(tax)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SAWT - ${fullName}</title>
    <style>
      @page { size: A4 landscape; margin: 15mm; }
      body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; }
      .header { text-align: center; margin-bottom: 6px; }
      .header h2 { font-size: 11pt; font-weight: bold; margin: 0; }
      .header h3 { font-size: 10pt; font-weight: bold; margin: 2px 0; }
      .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 9pt; }
      table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
      th { border: 1px solid #000; padding: 4px 6px; text-align: center; background: #f0f0f0; font-size: 8pt; }
      td { border: 1px solid #000; padding: 3px 6px; }
      .total-row td { font-weight: bold; border-top: 2px solid #000; }
      .grand-total { margin-top: 8px; text-align: right; font-weight: bold; font-size: 9pt; border-top: 2px solid #000; padding-top: 4px; }
      .footer { margin-top: 16px; font-size: 8pt; }
    </style></head><body>
    <div class="header"><h2>BIR FORM 1701Q</h2><h3>SUMMARY ALPHALIST OF WITHHOLDING TAXES (SAWT)</h3></div>
    <div class="meta">
      <div><strong>PAYEE\'S NAME:</strong> ${fullName}<br><strong>TIN:</strong> ${displayTin}</div>
      <div style="text-align:right"><strong>FOR THE MONTH OF ${monthName}, ${year}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:40px">SEQ.<br>NO.</th>
        <th style="width:120px">TAXPAYER<br>IDENTIFICATION<br>NUMBER (TIN)</th>
        <th style="width:50px">ATC</th>
        <th style="width:40px">RATE</th>
        <th>CORPORATION / INDIVIDUAL<br>(Registered Name)</th>
        <th style="width:110px">INCOME<br>PAYMENT</th>
        <th style="width:110px">AMOUNT OF TAX<br>WITHHELD</th>
      </tr></thead>
      <tbody>
        ${tableRows}
        <tr class="total-row">
          <td colspan="5" style="text-align:right">PAGE TOTAL</td>
          <td style="text-align:right">${fmtNum(totalIncome)}</td>
          <td style="text-align:right">${fmtNum(totalTax)}</td>
        </tr>
      </tbody>
    </table>
    <div class="grand-total">GRAND TOTAL &nbsp;&nbsp;&nbsp; ${fmtNum(totalTax)}</div>
    <div class="footer">END OF REPORT</div>
    </body></html>`;

    const printWindow = window.open("", "_blank", "width=900,height=600");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 500);
    }
  };

  const buildSAWTContent = (client: any, quarterNum: number, quarterForms: any[], yearStr: string) => {
    const tin = (client.tin || "").replace(/\D/g, "");
    const tinMain = tin.substring(0, 9).padEnd(9, "0");
    const tinBranch = tin.substring(9, 13).padEnd(4, "0");
    const lastName = client.last_name || "";
    const firstName = client.first_name || "";
    const middleName = client.middle_name || "";
    const rdo = client.rdo_code || "000";
    const lastMonth = quarterNum * 3;
    const lastMonthPadded = String(lastMonth).padStart(2, "0");
    const period = `${lastMonthPadded}/${yearStr}`;
    const monthName = MONTHS[lastMonth - 1];
    const displayTin = `${tinMain.substring(0,3)}-${tinMain.substring(3,6)}-${tinMain.substring(6,9)}-${tinBranch}`;
    const fullName = `${lastName}, ${firstName} ${middleName}`.trim();
    const totalIncome = quarterForms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0), 0);
    const totalTax = quarterForms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0), 0);
    const lines: string[] = [];
    lines.push(`HSAWT,H1701Q,${tinMain},${tinBranch},"","${lastName}","${firstName}","${middleName}",${period},${rdo}`);
    quarterForms.forEach((f: any, i: number) => {
      const payorTin = (f?.atc_tin || f?.payor_tin || "").replace(/\D/g, "").substring(0, 9).padEnd(9, "0");
      const payorName = (f?.payor_name || f?.client_name || "").toUpperCase().replace(/"/g, "").replace(/\.$/, "").trim();
      const atc = f?.atc || "WI120";
      const income = parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0;
      const tax = parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0;
      const rate = income > 0 ? parseFloat((tax / income * 100).toFixed(2)) : 2.00;
      lines.push(`DSAWT,D1701Q,${i + 1},${payorTin},0000,"${payorName}",,,,${period},,${atc},${rate.toFixed(2)},${income.toFixed(2)},${tax.toFixed(2)}`);
    });
    lines.push(`CSAWT,C1701Q,${tinMain},${tinBranch},${period},${totalIncome.toFixed(2)},${totalTax.toFixed(2)}`);
    const datContent = lines.join("\r\n") + "\r\n";
    const datFilename = `${tinMain}${tinBranch}${lastMonthPadded}${yearStr}1701Q.DAT`;
    const fmtNum = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tableRows = quarterForms.map((f: any, i: number) => {
      const payorTinRaw = (f?.atc_tin || f?.payor_tin || "").replace(/\D/g, "");
      const payorTinFmt = payorTinRaw.length >= 9 ? `${payorTinRaw.substring(0,3)}-${payorTinRaw.substring(3,6)}-${payorTinRaw.substring(6,9)}-${payorTinRaw.substring(9,13) || "0000"}` : payorTinRaw;
      const payorName = (f?.payor_name || f?.client_name || "").toUpperCase().replace(/\.$/, "").trim();
      const atc = f?.atc || "WI120";
      const income = parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0;
      const tax = parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0;
      return `<tr><td style="text-align:center">${i+1}</td><td>${payorTinFmt}</td><td style="text-align:center">${atc}</td><td style="text-align:center">${income > 0 ? (tax/income*100).toFixed(2) : "2.00"}</td><td>${payorName}</td><td style="text-align:right">${fmtNum(income)}</td><td style="text-align:right">${fmtNum(tax)}</td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SAWT - ${fullName}</title><style>@page{size:A4 landscape;margin:15mm}body{font-family:Arial,sans-serif;font-size:9pt;color:#000}.header{text-align:center;margin-bottom:6px}.header h2{font-size:11pt;font-weight:bold;margin:0}.header h3{font-size:10pt;font-weight:bold;margin:2px 0}.meta{display:flex;justify-content:space-between;margin-bottom:8px;font-size:9pt}table{width:100%;border-collapse:collapse;font-size:8.5pt}th{border:1px solid #000;padding:4px 6px;text-align:center;background:#f0f0f0;font-size:8pt}td{border:1px solid #000;padding:3px 6px}.total-row td{font-weight:bold;border-top:2px solid #000}.grand-total{margin-top:8px;text-align:right;font-weight:bold;font-size:9pt;border-top:2px solid #000;padding-top:4px}.footer{margin-top:16px;font-size:8pt}</style></head><body><div class="header"><h2>BIR FORM 1701Q</h2><h3>SUMMARY ALPHALIST OF WITHHOLDING TAXES (SAWT)</h3></div><div class="meta"><div><strong>PAYEE'S NAME:</strong> ${fullName}<br><strong>TIN:</strong> ${displayTin}</div><div style="text-align:right"><strong>FOR THE MONTH OF ${monthName}, ${yearStr}</strong></div></div><table><thead><tr><th style="width:40px">SEQ.<br>NO.</th><th style="width:120px">TAXPAYER<br>IDENTIFICATION<br>NUMBER (TIN)</th><th style="width:50px">ATC</th><th style="width:40px">RATE</th><th>CORPORATION / INDIVIDUAL<br>(Registered Name)</th><th style="width:110px">INCOME<br>PAYMENT</th><th style="width:110px">AMOUNT OF TAX<br>WITHHELD</th></tr></thead><tbody>${tableRows}<tr class="total-row"><td colspan="5" style="text-align:right">PAGE TOTAL</td><td style="text-align:right">${fmtNum(totalIncome)}</td><td style="text-align:right">${fmtNum(totalTax)}</td></tr></tbody></table><div class="grand-total">GRAND TOTAL &nbsp;&nbsp;&nbsp; ${fmtNum(totalTax)}</div><div class="footer">END OF REPORT</div></body></html>`;
    return { datContent, datFilename, html, tinMain, tinBranch, displayTin, fullName };
  };

  const openBatchModal = async (quarterStr: string) => {
    const qNum = parseInt(quarterStr.replace("Q", ""));
    const { data: uploads } = await supabase.from("uploads").select("*").eq("status", "extracted");
    const allUploads = uploads || [];
    const result: { client: any; forms: any[] }[] = [];
    for (const client of clients.filter(c => !c.tax_type || c.tax_type === "8%")) {
      const forms2307 = allUploads.filter(u => {
        const d = parseData(u.extracted_data);
        return d?.payee_tin?.replace(/\D/g, "").includes(client.tin?.replace(/\D/g, "") || "NOMATCH") ||
               d?.payee_name?.toLowerCase().includes(client.name.toLowerCase());
      });
      const qForms: any[] = [];
      forms2307.forEach(u => {
        const d = parseData(u.extracted_data);
        const period = d?.period_to || d?.period_from || "";
        const month = parseInt(period.split("/")[0]) || 0;
        const startMonth = (qNum - 1) * 3 + 1;
        const endMonth = qNum * 3;
        if (month >= startMonth && month <= endMonth) qForms.push(d);
      });
      if (qForms.length > 0) result.push({ client, forms: qForms });
    }
    setBatchModal({ quarter: quarterStr, clientsWithForms: result });
  };

  const runBatchGenerate = async (selected: { client: any; forms: any[] }[], quarterStr: string) => {
    setBatchGenerating(true);
    const qNum = parseInt(quarterStr.replace("Q", ""));
    const lastMonth = qNum * 3;
    const lastMonthPadded = String(lastMonth).padStart(2, "0");
    const now = new Date().toLocaleString("en-PH");
    let summaryTxt = `BATCH SAWT GENERATION SUMMARY\n`;
    summaryTxt += `Quarter: ${quarterStr} ${year}\n`;
    summaryTxt += `Generated: ${now}\n`;
    summaryTxt += `Total clients: ${selected.length}\n\n`;
    summaryTxt += `${"TIN".padEnd(20)} ${"CLIENT NAME".padEnd(35)} FILENAME\n`;
    summaryTxt += `${"-".repeat(80)}\n`;
    selected.forEach(({ client }) => {
      const tin = (client.tin || "").replace(/\D/g, "");
      const tinMain = tin.substring(0, 9).padEnd(9, "0");
      const tinBranch = tin.substring(9, 13).padEnd(4, "0");
      const displayTin = `${tinMain.substring(0,3)}-${tinMain.substring(3,6)}-${tinMain.substring(6,9)}-${tinBranch}`;
      const datFilename = `${tinMain}${tinBranch}${lastMonthPadded}${year}1701Q.DAT`;
      const fullName = `${client.last_name || ""}, ${client.first_name || ""}`.trim() || client.name;
      summaryTxt += `${displayTin.padEnd(20)} ${fullName.substring(0, 34).padEnd(35)} ${datFilename}\n`;
    });
    summaryTxt += `${"-".repeat(80)}\n`;
    const summaryBlob = new Blob([summaryTxt], { type: "text/plain" });
    const summaryUrl = URL.createObjectURL(summaryBlob);
    const summaryLink = document.createElement("a");
    summaryLink.href = summaryUrl;
    summaryLink.download = `BATCH_SAWT_${quarterStr}_${year}_SUMMARY.TXT`;
    summaryLink.click();
    URL.revokeObjectURL(summaryUrl);
    for (let i = 0; i < selected.length; i++) {
      await new Promise(resolve => setTimeout(resolve, i === 0 ? 500 : 1200));
      const { client, forms } = selected[i];
      const { datContent, datFilename, html } = buildSAWTContent(client, qNum, forms, year);
      const datBlob = new Blob([datContent], { type: "text/plain" });
      const datUrl = URL.createObjectURL(datBlob);
      const datLink = document.createElement("a");
      datLink.href = datUrl;
      datLink.download = datFilename;
      datLink.click();
      URL.revokeObjectURL(datUrl);
      await new Promise(resolve => setTimeout(resolve, 400));
      const safeName = (client.last_name || client.name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 12);
      const htmlFilename = `SAWT-${datFilename.replace(".DAT","")}-${safeName}.html`;
      const htmlWithPrint = html.replace("</body>", "<script>window.onload=function(){window.print();}<\/script></body>");
      const htmlBlob = new Blob([htmlWithPrint], { type: "text/html" });
      const htmlUrl = URL.createObjectURL(htmlBlob);
      const htmlLink = document.createElement("a");
      htmlLink.href = htmlUrl;
      htmlLink.download = htmlFilename;
      htmlLink.click();
      URL.revokeObjectURL(htmlUrl);
    }
    setBatchGenerating(false);
  };

  const computeSummary = async (client: any) => {
    setSelected(client);
    setListOpen(false);
    setActiveQuarter("Q1");
    setLoading(true);
    try {
      const { data: uploads } = await supabase.from("uploads").select("*").eq("status", "extracted");
      const forms2307 = (uploads || []).filter(u => {
        const data = parseData(u.extracted_data);
        return data?.payee_tin?.replace(/\D/g, "").includes(client.tin?.replace(/\D/g, "") || "NOMATCH") ||
               data?.payee_name?.toLowerCase().includes(client.name.toLowerCase());
      });
      const { data: credits } = await supabase.from("prior_year_credits").select("*")
        .eq("client_id", client.id).eq("year", parseInt(year) - 1);
      const priorCredit = credits?.reduce((sum: number, c: any) => sum + (c.excess_credit || 0), 0) || 0;
      const { data: payments } = await supabase.from("tax_payments").select("*")
        .eq("client_id", client.id).eq("year", parseInt(year));
      const quarters: any = { Q1: [], Q2: [], Q3: [], Q4: [] };
      forms2307.forEach(u => {
        const data = parseData(u.extracted_data);
        const period = data?.period_to || data?.period_from || "";
        const month = parseInt(period.split("/")[0]) || 0;
        if (month >= 1 && month <= 3) quarters.Q1.push(data);
        else if (month >= 4 && month <= 6) quarters.Q2.push(data);
        else if (month >= 7 && month <= 9) quarters.Q3.push(data);
        else if (month >= 10 && month <= 12) quarters.Q4.push(data);
      });
      let cumulativeIncome = 0;
      let cumulativeCWT = 0;
      let previousPaid = 0;
      const EXEMPTION = 250000;
      const qSummaries = [];
      for (const [q, forms] of Object.entries(quarters) as any) {
        const qNum = parseInt(q.replace("Q", ""));
        const item47 = forms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0), 0);
        const item49 = item47;
        const item50 = cumulativeIncome;
        const item51 = item49 + item50;
        const item52 = EXEMPTION;
        const item53 = item51 - item52;
        const item54 = Math.max(0, item53 * 0.08);
        const item55 = priorCredit;
        const item56 = previousPaid;
        const item57 = cumulativeCWT;
        const item58 = forms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0), 0);
        const item62 = item55 + item56 + item57 + item58;
        const item63 = item54 - item62;
        const qPayment = payments?.find((p: any) => p.quarter === qNum)?.amount_paid || 0;
        qSummaries.push({
          quarter: q, forms: forms.length,
          item47, item49, item50, item51, item52, item53, item54,
          item55, item56, item57, item58, item62, item63,
          paid: qPayment,
          isOverpayment: item63 < 0,
          isNoTaxDue: item54 === 0 && item63 <= 0,
          rawForms: forms,
        });
        cumulativeIncome = item51;
        cumulativeCWT += item58;
        previousPaid += qPayment;
      }
      setSummary({ client, quarters: qSummaries, totalForms: forms2307.length, priorCredit });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const parseData = (data: any) => {
    try {
      let parsed = data;
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed;
    } catch { return data; }
  };

  const fmt = (n: number) => `₱${Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const clients8 = clients.filter(c => (!c.tax_type || c.tax_type === "8%") &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || (c.tin || "").includes(search)));
  const clientsGrad = clients.filter(c => c.tax_type === "graduated" &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || (c.tin || "").includes(search)));
  const totalPages8 = Math.ceil(clients8.length / PAGE_SIZE);
  const totalPagesGrad = Math.ceil(clientsGrad.length / PAGE_SIZE);
  const pagedClients8 = clients8.slice((page8 - 1) * PAGE_SIZE, page8 * PAGE_SIZE);
  const pagedClientsGrad = clientsGrad.slice((pageGrad - 1) * PAGE_SIZE, pageGrad * PAGE_SIZE);
  const showList = listOpen || search.length > 0;
  const activeQ = summary?.quarters.find((q: any) => q.quarter === activeQuarter);
  const drawerOpen = !!editingClient;

  const renderClientList = (list: any[], page: number, totalPages: number, setPage: any) => (
    <div>
      {list.length === 0 ? (
        <p style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          {search ? "No clients match your search." : "No clients yet."}
        </p>
      ) : list.map(client => (
        <div key={client.id} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
          <div onClick={() => { computeSummary(client); setSearch(""); }} style={{ padding: "11px 16px", cursor: "pointer", background: selected?.id === client.id ? "rgba(99,102,241,0.1)" : "transparent", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{client.tin || "No TIN"}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); openEdit(client); }} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginLeft: 8 }}>
              Edit
            </button>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: page === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: page === 1 ? "default" : "pointer", fontFamily: "inherit" }}>‹ Prev</button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{page} / {totalPages}</span>
          <button onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: page === totalPages ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: page === totalPages ? "default" : "pointer", fontFamily: "inherit" }}>Next ›</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #0f0f0f; overflow-x: auto; }
        input, select { outline: none; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      {showValidator && <DATValidatorModal onClose={() => setShowValidator(false)} />}
      {batchModal && (
        <BatchSAWTModal
          quarter={batchModal.quarter}
          yearStr={year}
          clientsWithForms={batchModal.clientsWithForms}
          onClose={() => setBatchModal(null)}
          onConfirm={runBatchGenerate}
        />
      )}
      {batchGenerating && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998, padding: "12px 18px", background: "#1a1a1a", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          <i className="ti ti-loader-2" style={{ fontSize: 16, color: "#a5b4fc" }} />
          <p style={{ fontSize: 13, color: "#fff" }}>Generating batch SAWT files...</p>
        </div>
      )}

      <div style={{ display: "flex", minHeight: "100vh", transition: "all 0.25s ease" }}>
        <div style={{ flex: 1, minWidth: drawerOpen ? "900px" : "0", transition: "margin-right 0.25s ease", marginRight: drawerOpen ? "320px" : "0" }}>
          <main style={{ minHeight: "100vh", background: "#0f0f0f", backgroundImage: "radial-gradient(circle at top left, rgba(99,102,241,0.08) 0%, transparent 40%)", padding: "2rem 1.5rem", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>

              {/* Nav */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
                <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="ti ti-calculator" style={{ color: "#fff", fontSize: 18 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>Tax Summary Engine</h1>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>BIR 1701Q — Income Tax Compliance</p>
                </div>
                <button onClick={() => openBatchModal(activeQuarter)} disabled={batchGenerating} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(99,102,241,0.1)", border: "0.5px solid rgba(99,102,241,0.25)", borderRadius: 10, color: "#a5b4fc", fontSize: 13, cursor: batchGenerating ? "default" : "pointer", fontFamily: "inherit", opacity: batchGenerating ? 0.5 : 1 }}>
                  <i className="ti ti-files" style={{ fontSize: 14 }} /> Batch SAWT
                </button>
                <button
                  onClick={() => setShowValidator(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(16,185,129,0.1)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 10, color: "#6ee7b7", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                >
                  <i className="ti ti-shield-check" style={{ fontSize: 14 }} /> Validate DAT
                </button>
                <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none" }}>
                  <i className="ti ti-arrow-left" style={{ fontSize: 14 }} /> Back to Dashboard
                </Link>
              </div>

              {/* Year selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
                <label style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Tax Year:</label>
                <select value={year} onChange={e => setYear(e.target.value)} style={{ padding: "8px 12px", background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>

                {/* Clients Panel */}
                <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", alignSelf: "start" }}>
                  <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Clients ({clients.length})</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setListOpen(!listOpen); setSearch(""); }} style={{ padding: "5px 10px", background: listOpen ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", border: `0.5px solid ${listOpen ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: listOpen ? "#a5b4fc" : "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                        <i className="ti ti-list" style={{ fontSize: 13 }} />
                      </button>
                      <button onClick={() => setShowAddClient(!showAddClient)} style={{ padding: "5px 10px", background: "rgba(99,102,241,0.2)", border: "0.5px solid rgba(99,102,241,0.35)", borderRadius: 8, color: "#a5b4fc", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                        + Add
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                    {(["8%", "graduated"] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveFolderTab(tab)} style={{ flex: 1, padding: "9px 8px", background: activeFolderTab === tab ? "rgba(99,102,241,0.12)" : "transparent", border: "none", borderBottom: activeFolderTab === tab ? "2px solid #6366f1" : "2px solid transparent", color: activeFolderTab === tab ? "#a5b4fc" : "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                        {tab === "8%" ? "8% Filers" : "Graduated"} ({tab === "8%" ? clients8.length : clientsGrad.length})
                      </button>
                    ))}
                  </div>

                  {selected && !showList && (
                    <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(99,102,241,0.08)" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#a5b4fc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</p>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{selected.tin || "No TIN"}</p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                        <button onClick={() => openEdit(selected)} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                        <button onClick={() => setListOpen(true)} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Change</button>
                      </div>
                    </div>
                  )}

                  <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                    <input placeholder="Search name or TIN..." value={search} onChange={e => { setSearch(e.target.value); setListOpen(true); }} style={{ width: "100%", padding: "7px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit" }} />
                  </div>

                  {showAddClient && (
                    <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", background: "rgba(99,102,241,0.04)" }}>
                      <input placeholder="Full name *" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <input placeholder="TIN (e.g. 123-456-789-0000)" value={newTin} onChange={e => setNewTin(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <select value={newTaxType} onChange={e => setNewTaxType(e.target.value as "8%" | "graduated")} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8, cursor: "pointer" }}>
                        <option value="8%">8% Income Tax Rate</option>
                        <option value="graduated">Graduated IT Rate</option>
                      </select>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Name for SAWT</p>
                      <input placeholder="Last Name" value={newLastName} onChange={e => setNewLastName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6 }} />
                      <input placeholder="First Name" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6 }} />
                      <input placeholder="Middle Name" value={newMiddleName} onChange={e => setNewMiddleName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6 }} />
                      <input placeholder="RDO Code (e.g. 015)" value={newRdo} onChange={e => setNewRdo(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <input placeholder="Prior year excess credit (₱)" value={newCredit} onChange={e => setNewCredit(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <input placeholder="Credit from year (e.g. 2025)" value={creditYear} onChange={e => setCreditYear(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <button onClick={addClient} style={{ width: "100%", padding: "8px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save Client</button>
                    </div>
                  )}

                  {showList && (activeFolderTab === "8%" ? renderClientList(pagedClients8, page8, totalPages8, setPage8) : renderClientList(pagedClientsGrad, pageGrad, totalPagesGrad, setPageGrad))}
                </div>

                {/* Summary Panel */}
                <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "1.5rem", overflowY: "auto" }}>
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                      <i className="ti ti-loader-2" style={{ fontSize: 20, marginRight: 8 }} /> Computing summary...
                    </div>
                  ) : summary ? (
                    summary.client.tax_type === "graduated" ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
                        <div style={{ width: 52, height: 52, background: "rgba(251,191,36,0.08)", border: "0.5px solid rgba(251,191,36,0.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <i className="ti ti-clock" style={{ fontSize: 24, color: "rgba(251,191,36,0.5)" }} />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{summary.client.name}</p>
                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Graduated IT Rate computation coming soon.</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
                          <div>
                            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{summary.client.name}</h2>
                            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>TIN: {summary.client.tin || "N/A"} · {summary.totalForms} 2307s found · Tax Year {year}</p>
                          </div>
                          {summary.priorCredit > 0 && (
                            <div style={{ padding: "6px 12px", background: "rgba(16,185,129,0.1)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 10 }}>
                              <p style={{ fontSize: 11, color: "#6ee7b7" }}>Prior Year Credit: {fmt(summary.priorCredit)}</p>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem" }}>
                          {summary.quarters.map((q: any) => {
                            const isActive = activeQuarter === q.quarter;
                            const label = q.isNoTaxDue ? "No Tax Due" : q.isOverpayment ? "Overpaid" : fmt(q.item63);
                            const labelColor = q.isNoTaxDue ? (isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)") : q.isOverpayment ? "#6ee7b7" : (isActive ? "#fcd34d" : "rgba(252,211,77,0.5)");
                            return (
                              <button key={q.quarter} onClick={() => setActiveQuarter(q.quarter)} style={{ flex: 1, padding: "10px 8px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: isActive ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.04)", border: isActive ? "none" : "0.5px solid rgba(255,255,255,0.08)", transition: "all 0.15s" }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#fff" : "rgba(255,255,255,0.4)", marginBottom: 4 }}>{q.quarter}</p>
                                <p style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)" }}>{q.forms} 2307{q.forms !== 1 ? "s" : ""}</p>
                                <p style={{ fontSize: 11, fontWeight: 600, color: labelColor, marginTop: 4 }}>{label}</p>
                              </button>
                            );
                          })}
                        </div>
                        {activeQ && (
                          <div style={{ padding: "20px", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{activeQ.quarter} {year} — Detail</p>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: activeQ.forms > 0 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", color: activeQ.forms > 0 ? "#6ee7b7" : "rgba(255,255,255,0.3)", border: `0.5px solid ${activeQ.forms > 0 ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}` }}>
                                  {activeQ.forms} 2307{activeQ.forms !== 1 ? "s" : ""}
                                </span>
                                {activeQ.forms > 0 && (
                                  <button onClick={() => generateSAWT(summary.client, parseInt(activeQ.quarter.replace("Q", "")), activeQ.rawForms)} style={{ padding: "4px 12px", background: "rgba(16,185,129,0.15)", border: "0.5px solid rgba(16,185,129,0.3)", borderRadius: 8, color: "#6ee7b7", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                                    <i className="ti ti-file-download" style={{ fontSize: 12 }} /> Generate SAWT
                                  </button>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.5px", marginBottom: 10, textTransform: "uppercase" }}>Schedule II — Income</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {[
                                    { label: "47 · Quarterly Income", value: fmt(activeQ.item47), color: "#fff" },
                                    { label: "50 · Add: Prev Quarters", value: fmt(activeQ.item50), color: "#fff" },
                                    { label: "51 · Cumulative Income", value: fmt(activeQ.item51), color: "#fff", bold: true },
                                    { label: "52 · Less: ₱250,000", value: `(${fmt(activeQ.item52)})`, color: "#6ee7b7" },
                                    { label: "53 · Taxable Income", value: activeQ.item53 < 0 ? `(${fmt(activeQ.item53)})` : fmt(activeQ.item53), color: activeQ.item53 < 0 ? "#fca5a5" : "#fff", bold: true },
                                    { label: "54 · Tax Due (8%)", value: fmt(activeQ.item54), color: "#a5b4fc", bold: true },
                                  ].map(row => (
                                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{row.label}</span>
                                      <span style={{ fontSize: 12, color: row.color, fontWeight: row.bold ? 600 : 400 }}>{row.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.5px", marginBottom: 10, textTransform: "uppercase" }}>Schedule III — Credits</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {[
                                    { label: "55 · Prior Year Credits", value: `(${fmt(activeQ.item55)})`, color: "#6ee7b7" },
                                    { label: "56 · Prev Qtr Payments", value: `(${fmt(activeQ.item56)})`, color: "#6ee7b7" },
                                    { label: "57 · CWT Prev Quarters", value: `(${fmt(activeQ.item57)})`, color: "#6ee7b7" },
                                    { label: "58 · CWT This Quarter", value: `(${fmt(activeQ.item58)})`, color: "#6ee7b7" },
                                    { label: "62 · Total Credits", value: `(${fmt(activeQ.item62)})`, color: "#6ee7b7", bold: true },
                                  ].map(row => (
                                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{row.label}</span>
                                      <span style={{ fontSize: 12, color: row.color, fontWeight: (row as any).bold ? 600 : 400 }}>{row.value}</span>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ marginTop: 16, padding: "14px 16px", background: activeQ.isNoTaxDue ? "rgba(255,255,255,0.03)" : activeQ.isOverpayment ? "rgba(16,185,129,0.08)" : "rgba(252,211,77,0.06)", border: `0.5px solid ${activeQ.isNoTaxDue ? "rgba(255,255,255,0.08)" : activeQ.isOverpayment ? "rgba(16,185,129,0.25)" : "rgba(252,211,77,0.2)"}`, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: activeQ.isNoTaxDue ? "rgba(255,255,255,0.4)" : activeQ.isOverpayment ? "#6ee7b7" : "#fcd34d" }}>63 · {activeQ.isNoTaxDue ? "No Tax Due" : activeQ.isOverpayment ? "Overpayment" : "Tax Payable"}</span>
                                  <span style={{ fontSize: 16, fontWeight: 700, color: activeQ.isNoTaxDue ? "rgba(255,255,255,0.4)" : activeQ.isOverpayment ? "#6ee7b7" : "#fcd34d" }}>{activeQ.isNoTaxDue ? "₱0.00" : activeQ.isOverpayment ? `(${fmt(activeQ.item63)})` : fmt(activeQ.item63)}</span>
                                </div>
                                {activeQ.paid > 0 && (
                                  <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(99,102,241,0.06)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Payment Made This Quarter</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "#a5b4fc" }}>{fmt(activeQ.paid)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        <div style={{ padding: "16px", background: "rgba(99,102,241,0.06)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 14 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Annual Summary {year}</p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                            {[
                              { label: "Total Income", value: fmt(summary.quarters[summary.quarters.length - 1]?.item51 || 0), color: "#fff" },
                              { label: "Taxable Income", value: fmt(summary.quarters[summary.quarters.length - 1]?.item53 || 0), color: summary.quarters[summary.quarters.length - 1]?.item53 < 0 ? "#fca5a5" : "#fff" },
                              { label: "Annual Tax Due", value: fmt(summary.quarters[summary.quarters.length - 1]?.item54 || 0), color: "#a5b4fc" },
                              { label: "Total Credits/Payments", value: fmt(summary.quarters[summary.quarters.length - 1]?.item62 || 0), color: "#6ee7b7" },
                            ].map(item => (
                              <div key={item.label}>
                                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{item.label}</p>
                                <p style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
                      <div style={{ width: 52, height: 52, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className="ti ti-calculator" style={{ fontSize: 24, color: "rgba(255,255,255,0.2)" }} />
                      </div>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Select a client to compute tax summary</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Edit Drawer */}
        <div style={{ position: "fixed", top: 0, right: 0, height: "100vh", width: "320px", background: "#1a1a1a", borderLeft: "0.5px solid rgba(255,255,255,0.08)", zIndex: 100, display: "flex", flexDirection: "column", transform: drawerOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s ease", overflowY: "auto" }}>
          <div style={{ padding: "20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Edit Client</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{editingClient?.name}</p>
            </div>
            <button onClick={() => { setEditingClient(null); setDeletedPayments([]); }} style={{ width: 28, height: 28, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0, marginLeft: 8 }}>✕</button>
          </div>
          <div style={{ padding: "16px 20px", flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Tax Type</p>
            <select value={editTaxType} onChange={e => setEditTaxType(e.target.value as any)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 14, cursor: "pointer" }}>
              <option value="8%">8% Income Tax Rate</option>
              <option value="graduated">Graduated IT Rate</option>
            </select>
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Name (for SAWT)</p>
            <input placeholder="Last Name" value={editLastName} onChange={e => setEditLastName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="First Name" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="Middle Name" value={editMiddleName} onChange={e => setEditMiddleName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="RDO Code (e.g. 015)" value={editRdo} onChange={e => setEditRdo(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 14, outline: "none" }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Prior Year Excess Credit</p>
            <input placeholder="Amount (₱)" value={editCredit} onChange={e => setEditCredit(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="From year (e.g. 2025)" value={editCreditYear} onChange={e => setEditCreditYear(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 14, outline: "none" }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Tax Payments Made ({year})</p>
            {(["Q1", "Q2", "Q3"] as const).map(q => {
              const qNum = parseInt(q.replace("Q", ""));
              const isDeleted = deletedPayments.includes(qNum);
              return (
                <div key={q} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input placeholder={`${q} payment (₱)`} value={editPayments[q]} onChange={e => setEditPayments(prev => ({ ...prev, [q]: e.target.value }))} disabled={isDeleted} style={{ flex: 1, padding: "8px 10px", background: isDeleted ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: isDeleted ? "rgba(255,255,255,0.2)" : "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                  {isDeleted ? (
                    <button onClick={() => setDeletedPayments(prev => prev.filter(n => n !== qNum))} style={{ padding: "8px 10px", background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#a5b4fc", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Undo</button>
                  ) : (
                    <button onClick={() => clearPayment(qNum)} style={{ padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#fca5a5", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>✕</button>
                  )}
                </div>
              );
            })}
            <button onClick={saveEditClient} style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 16 }}>Save Changes</button>
          </div>
        </div>
      </div>
    </>
  );
}
