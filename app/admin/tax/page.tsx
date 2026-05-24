/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import {
  validateDAT,
  generateSAWTContent,
  parseExtractedData,
  writeFileToDir,
  fallbackDownload,
  fmtPeso,
  normalizeTin,
  parseAmount,
  type DATValidationResult,
  type ExtractedForm,
} from "@/lib/sawt";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAGE_SIZE = 10;

function DATValidatorModal({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<DATValidationResult[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const processFiles = (files: File[]) => {
    const datFiles = files.filter(f => /\.(dat|txt)$/i.test(f.name));
    if (!datFiles.length) return;
    let loaded = 0;
    const newResults: { filename: string; content: string }[] = [];
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

  const downloadTxt = (r: DATValidationResult) => {
    fallbackDownload(r.filename.replace(/\.(dat|txt)$/i, "") + ".TXT", r.txtReport, "text/plain");
  };

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const btnStyle: React.CSSProperties = { padding: "3px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 11, fontFamily: "inherit", cursor: "pointer", outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 760, background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden" }}>
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
          <div onDrop={e => { e.preventDefault(); processFiles(Array.from(e.dataTransfer.files)); }} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()} style={{ border: "1.5px dashed rgba(255,255,255,0.12)", borderRadius: 14, padding: "1.5rem", textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.02)", marginBottom: 16 }}>
            <i className="ti ti-files" style={{ fontSize: 28, color: "rgba(255,255,255,0.2)" }} />
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>Drop .DAT files here or click to browse</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>Single or multiple files accepted</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".dat,.DAT,.txt,.TXT" multiple style={{ display: "none" }} onChange={e => { processFiles(Array.from(e.target.files || [])); if (fileInputRef.current) fileInputRef.current.value = ""; }} />
          {total > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, marginBottom: 14, background: passed === total ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `0.5px solid ${passed === total ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i className={`ti ti-${passed === total ? "circle-check" : "alert-circle"}`} style={{ fontSize: 16, color: passed === total ? "#6ee7b7" : "#fca5a5" }} />
                <p style={{ fontSize: 13, fontWeight: 500, color: passed === total ? "#6ee7b7" : "#fca5a5" }}>{passed} of {total} file{total !== 1 ? "s" : ""} passed validation</p>
              </div>
              <button onClick={() => setResults([])} style={{ ...btnStyle, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                <i className="ti ti-trash" style={{ fontSize: 12 }} /> Clear all
              </button>
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
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
              {expanded[i] && (
                <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", padding: "14px" }}>
                  {r.hInfo && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
                      {[["TIN", r.hInfo.tin], ["Name", r.hInfo.name || "—"], ["Period", r.hInfo.period], ["RDO", r.hInfo.rdo || "—"], ["2307s", r.hInfo.dCount]].map(([label, val]) => (
                        <div key={String(label)} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "7px 10px" }}>
                          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>{label}</p>
                          <p style={{ fontSize: 11, fontWeight: 500, color: "#fff", wordBreak: "break-all" }}>{val}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {r.structErrors.length > 0 && (
                    <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#fca5a5", marginBottom: 4 }}><i className="ti ti-alert-triangle" style={{ fontSize: 12 }} /> Structure errors</p>
                      {r.structErrors.map((e, j) => <p key={j} style={{ fontSize: 11, color: "#fca5a5", marginTop: 3 }}>· {e}</p>)}
                    </div>
                  )}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12 }}>
                    <thead><tr>{["Line", "Type", "Status"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {r.lineResults.map((l, j) => (
                        <tr key={j}>
                          <td style={{ padding: "5px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", fontFamily: "monospace", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{l.lineNum}</td>
                          <td style={{ padding: "5px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)", fontWeight: 500, color: "#fff", fontSize: 11 }}>{l.type}</td>
                          <td style={{ padding: "5px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                            {l.errors.length === 0 && l.warnings.length === 0 && <span style={{ fontSize: 10, color: "#6ee7b7" }}>● OK</span>}
                            {l.errors.length > 0 && <><span style={{ fontSize: 10, color: "#fca5a5" }}>● Error</span>{l.errors.map((e, k) => <div key={k} style={{ fontSize: 10, color: "#fca5a5", marginTop: 2 }}>· {e}</div>)}</>}
                            {l.warnings.length > 0 && <>{l.errors.length === 0 && <span style={{ fontSize: 10, color: "#fcd34d" }}>● Warning</span>}{l.warnings.map((w, k) => <div key={k} style={{ fontSize: 10, color: "#fcd34d", marginTop: 2 }}>⚠ {w}</div>)}</>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>BIR-style validation report</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => navigator.clipboard.writeText(r.txtReport).catch(() => {})} style={btnStyle}><i className="ti ti-copy" style={{ fontSize: 11 }} /> Copy</button>
                      <button onClick={() => downloadTxt(r)} style={btnStyle}><i className="ti ti-download" style={{ fontSize: 11 }} /> Download .TXT</button>
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

function BatchSAWTModal({ quarter, yearStr, clientsWithForms, onClose, onConfirm }: {
  quarter: string;
  yearStr: string;
  clientsWithForms: { client: any; forms: ExtractedForm[] }[];
  onClose: () => void;
  onConfirm: (selected: { client: any; forms: ExtractedForm[] }[], quarter: string, folderName: string) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    clientsWithForms.forEach(c => { init[c.client.id] = true; });
    return init;
  });
  const [folderName, setFolderName] = useState(`SAWT-${quarter}-${yearStr}`);
  const selectedCount = Object.values(checked).filter(Boolean).length;
  const selectedClients = clientsWithForms.filter(c => checked[c.client.id]);
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" };
  const fsSupportedHint = typeof window !== "undefined" && "showDirectoryPicker" in window;

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
        <div style={{ maxHeight: 260, overflowY: "auto", padding: "8px 0" }}>
          {clientsWithForms.length === 0
            ? <p style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>No clients have 2307s for {quarter} {yearStr}.</p>
            : clientsWithForms.map(({ client, forms }) => (
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
        <div style={{ padding: "14px 20px", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <i className="ti ti-folder" style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Output folder name</p>
            {!fsSupportedHint && <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(251,191,36,0.1)", border: "0.5px solid rgba(251,191,36,0.25)", borderRadius: 20, color: "#fcd34d" }}>Falls back to Downloads</span>}
          </div>
          <input value={folderName} onChange={e => setFolderName(e.target.value.replace(/[/\\]/g, "-"))} placeholder={`SAWT-${quarter}-${yearStr}`} style={inputStyle} />
          {fsSupportedHint
            ? <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 5 }}>You&apos;ll be prompted to pick or create a folder — all files will be saved there.</p>
            : <p style={{ fontSize: 10, color: "rgba(251,191,36,0.5)", marginTop: 5 }}>Your browser doesn&apos;t support folder picking. Files will download to Downloads with the folder name as a filename prefix.</p>
          }
        </div>
        <div style={{ padding: "14px 20px", borderTop: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            Will generate: <span style={{ color: "#a5b4fc", fontWeight: 600 }}>{selectedCount} DAT</span>, <span style={{ color: "#a5b4fc", fontWeight: 600 }}>{selectedCount} HTML</span>, <span style={{ color: "#a5b4fc", fontWeight: 600 }}>1 summary TXT</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={() => selectedCount > 0 && onConfirm(selectedClients, quarter, folderName.trim() || `SAWT-${quarter}-${yearStr}`)} disabled={selectedCount === 0} style={{ padding: "8px 16px", background: selectedCount > 0 ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, color: selectedCount > 0 ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 600, cursor: selectedCount > 0 ? "pointer" : "default", fontFamily: "inherit" }}>
              <i className="ti ti-folder-down" style={{ fontSize: 13 }} /> Generate {selectedCount > 0 ? `(${selectedCount})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TaxPage() {
  const [sendStatus, setSendStatus] = useState("");
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
  const [batchModal, setBatchModal] = useState<{ quarter: string; clientsWithForms: { client: any; forms: ExtractedForm[] }[] } | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchStatus, setBatchStatus] = useState("");

  // ── Batch email state ──────────────────────────────────────────────────────
  const [batchEmailClients, setBatchEmailClients] = useState<{
    client: any;
    datContent: string;
    datFilename: string;
    quarterNum: number;
  }[]>([]);
  const [batchEmailSending, setBatchEmailSending] = useState(false);
  const [batchEmailStatus, setBatchEmailStatus] = useState("");
  // ──────────────────────────────────────────────────────────────────────────

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
    const { data: existingCredit } = await supabase.from("prior_year_credits").select("excess_credit").eq("client_id", client.id).eq("year", new Date().getFullYear() - 1).single();
    setEditCredit(existingCredit?.excess_credit?.toString() || "");
    const { data: existingPayments } = await supabase.from("tax_payments").select("quarter, amount_paid").eq("client_id", client.id).eq("year", parseInt(year));
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
    await supabase.from("clients").update({ tax_type: editTaxType, last_name: editLastName.trim() || null, first_name: editFirstName.trim() || null, middle_name: editMiddleName.trim() || null, rdo_code: editRdo.trim() || null }).eq("id", editingClient.id);
    if (editCredit) {
      const creditYearInt = parseInt(editCreditYear) || new Date().getFullYear() - 1;
      const { data: existing } = await supabase.from("prior_year_credits").select("id").eq("client_id", editingClient.id).eq("year", creditYearInt).single();
      if (existing) { await supabase.from("prior_year_credits").update({ excess_credit: parseFloat(editCredit) || 0 }).eq("id", existing.id); }
      else { await supabase.from("prior_year_credits").insert({ client_id: editingClient.id, year: creditYearInt, excess_credit: parseFloat(editCredit) || 0 }); }
    }
    for (const qNum of deletedPayments) { await supabase.from("tax_payments").delete().eq("client_id", editingClient.id).eq("year", parseInt(year)).eq("quarter", qNum); }
    for (const [q, amount] of Object.entries(editPayments)) {
      if (amount === "") continue;
      const qNum = parseInt(q.replace("Q", ""));
      if (deletedPayments.includes(qNum)) continue;
      const amountPaid = parseFloat(amount) || 0;
      const { data: existing } = await supabase.from("tax_payments").select("id").eq("client_id", editingClient.id).eq("year", parseInt(year)).eq("quarter", qNum).single();
      if (existing) { await supabase.from("prior_year_credits").update({ amount_paid: amountPaid }).eq("id", existing.id); }
      else { await supabase.from("tax_payments").insert({ client_id: editingClient.id, year: parseInt(year), quarter: qNum, amount_paid: amountPaid }); }
    }
    const updatedClient = { ...editingClient, tax_type: editTaxType, last_name: editLastName.trim() || null, first_name: editFirstName.trim() || null, middle_name: editMiddleName.trim() || null, rdo_code: editRdo.trim() || null };
    setEditingClient(null); setEditCredit(""); setEditPayments({ Q1: "", Q2: "", Q3: "" }); setDeletedPayments([]);
    fetchClients();
    if (selected?.id === editingClient.id) { setSelected(updatedClient); computeSummary(updatedClient); }
  }, [editingClient, editTaxType, editLastName, editFirstName, editMiddleName, editRdo, editCredit, editCreditYear, editPayments, deletedPayments, fetchClients, selected, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateSAWT = (client: any, quarterNum: number, quarterForms: ExtractedForm[]) => {
    const result = generateSAWTContent(
      { tin: client.tin || "", lastName: client.last_name || "", firstName: client.first_name || "", middleName: client.middle_name || "", rdoCode: client.rdo_code || "" },
      quarterNum,
      quarterForms,
      year
    );
    fallbackDownload(result.datFilename, result.datContent, "text/plain");
    const printWindow = window.open("", "_blank", "width=900,height=600");
    if (printWindow) {
      printWindow.document.write(result.html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 500);
    }
  };

  const handleSendEmail = async (client: any, quarterNum: number, quarterForms: ExtractedForm[]) => {
    try {
      const result = generateSAWTContent(
        { tin: client.tin || "", lastName: client.last_name || "", firstName: client.first_name || "", middleName: client.middle_name || "", rdoCode: client.rdo_code || "" },
        quarterNum,
        quarterForms,
        year
      );
      const fullName = `${client.first_name || ""} ${client.middle_name ? client.middle_name + " " : ""}${client.last_name || ""}`.trim().toUpperCase();
      const nameParts = (client.name || "").split("/");
      const registeredName = (nameParts.length > 1 ? nameParts[1] : nameParts[0]).trim().toUpperCase();
      const confirmed = window.confirm(`Send SAWT to BIR eSubmission?\n\n${fullName}\nQ${quarterNum} ${year}`);
      if (!confirmed) return;
      const resp = await fetch("/api/sawt/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datContent: result.datContent,
          datFilename: result.datFilename,
          clientName: fullName,
          registeredName,
          tin: result.displayTin,
          quarterNum,
          year,
        }),
      });
      if (resp.ok) {
        setSendStatus(`Sent: ${fullName}`);
        setTimeout(() => setSendStatus(""), 4000);
      } else {
        setSendStatus("Failed to send. Try again.");
        setTimeout(() => setSendStatus(""), 4000);
      }
    } catch {
      setSendStatus("Failed to send. Try again.");
      setTimeout(() => setSendStatus(""), 4000);
    }
  };

  // ── Batch email send ───────────────────────────────────────────────────────
  const handleBatchSendEmail = async () => {
    if (batchEmailClients.length === 0) return;
    setBatchEmailSending(true);
    setBatchEmailStatus("");
    let sent = 0;
    for (const item of batchEmailClients) {
      const { client, datContent, datFilename, quarterNum } = item;
      const fullName = `${client.first_name || ""} ${client.middle_name ? client.middle_name + " " : ""}${client.last_name || ""}`.trim().toUpperCase();
      const nameParts = (client.name || "").split("/");
      const registeredName = (nameParts.length > 1 ? nameParts[1] : nameParts[0]).trim().toUpperCase();
      const { display: displayTin } = normalizeTin(client.tin || "");
      setBatchEmailStatus(`Sending ${sent + 1} / ${batchEmailClients.length}: ${fullName}…`);
      try {
        await fetch("/api/sawt/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datContent,
            datFilename,
            clientName: fullName,
            registeredName,
            tin: displayTin,
            quarterNum,
            year,
          }),
        });
      } catch { /* continue even if one fails */ }
      sent++;
      await new Promise(r => setTimeout(r, 800));
    }
    setBatchEmailSending(false);
    setBatchEmailStatus(`Done — ${sent} email${sent !== 1 ? "s" : ""} sent.`);
    setTimeout(() => {
      setBatchEmailClients([]);
      setBatchEmailStatus("");
    }, 4000);
  };
  // ──────────────────────────────────────────────────────────────────────────

  const openBatchModal = async (quarterStr: string) => {
    const qNum = parseInt(quarterStr.replace("Q", ""));
    const { data: uploads } = await supabase.from("uploads").select("*").eq("status", "extracted");
    const allUploads = uploads || [];
    const result: { client: any; forms: ExtractedForm[] }[] = [];
    for (const client of clients.filter(c => !c.tax_type || c.tax_type === "8%")) {
      const forms2307 = allUploads.filter(u => {
        const d = parseExtractedData(u.extracted_data);
        return d?.payee_tin?.replace(/\D/g, "").includes(client.tin?.replace(/\D/g, "") || "NOMATCH") || d?.payee_name?.toLowerCase().includes(client.name.toLowerCase());
      });
      const qForms: ExtractedForm[] = [];
      forms2307.forEach(u => {
        const d = parseExtractedData(u.extracted_data);
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

  const runBatchGenerate = async (
    selectedClients: { client: any; forms: ExtractedForm[] }[],
    quarterStr: string,
    folderName: string
  ) => {
    setBatchModal(null);
    setBatchGenerating(true);
    setBatchStatus("Preparing files…");
    const qNum = parseInt(quarterStr.replace("Q", ""));
    const lastMonth = qNum * 3;
    const lastMonthPadded = String(lastMonth).padStart(2, "0");
    const now = new Date().toLocaleString("en-PH");
    let summaryTxt = `BATCH SAWT GENERATION SUMMARY\nQuarter: ${quarterStr} ${year}\nFolder: ${folderName}\nGenerated: ${now}\nTotal clients: ${selectedClients.length}\n\n`;
    summaryTxt += `${"TIN".padEnd(20)} ${"CLIENT NAME".padEnd(35)} FILENAME\n${"-".repeat(80)}\n`;
    selectedClients.forEach(({ client }) => {
      const { display: displayTin, main: tinMain, branch: tinBranch } = normalizeTin(client.tin || "");
      const datFilename = `${tinMain}${tinBranch}${lastMonthPadded}${year}1701Q.DAT`;
      const fullName = `${client.last_name || ""}, ${client.first_name || ""}`.trim() || client.name;
      summaryTxt += `${displayTin.padEnd(20)} ${fullName.substring(0, 34).padEnd(35)} ${datFilename}\n`;
    });
    summaryTxt += `${"-".repeat(80)}\n`;
    const summaryFilename = `BATCH_SAWT_${quarterStr}_${year}_SUMMARY.TXT`;
    const fsSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;
    let dirHandle: FileSystemDirectoryHandle | null = null;
    if (fsSupported) {
      try {
        setBatchStatus("Waiting for folder selection…");
        dirHandle = await (window as any).showDirectoryPicker({ startIn: "downloads", mode: "readwrite", suggestedName: folderName });
      } catch {
        setBatchGenerating(false); setBatchStatus(""); return;
      }
    }
    setBatchStatus("Writing summary…");
    if (dirHandle) { await writeFileToDir(dirHandle, summaryFilename, summaryTxt, "text/plain"); }
    else { fallbackDownload(summaryFilename, summaryTxt, "text/plain"); await new Promise(r => setTimeout(r, 500)); }

    // ── Collect email queue while writing files ──────────────────────────────
    const emailQueue: {
      client: any;
      datContent: string;
      datFilename: string;
      quarterNum: number;
    }[] = [];
    // ────────────────────────────────────────────────────────────────────────

    for (let i = 0; i < selectedClients.length; i++) {
      const { client, forms } = selectedClients[i];
      const clientLabel = (client.last_name || client.name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 12);
      setBatchStatus(`Writing ${i + 1} / ${selectedClients.length}: ${clientLabel}…`);
      const result = generateSAWTContent(
        { tin: client.tin || "", lastName: client.last_name || "", firstName: client.first_name || "", middleName: client.middle_name || "", rdoCode: client.rdo_code || "" },
        qNum,
        forms,
        year
      );

      // ── Push to email queue ──────────────────────────────────────────────
      emailQueue.push({
        client,
        datContent: result.datContent,
        datFilename: result.datFilename,
        quarterNum: qNum,
      });
      // ────────────────────────────────────────────────────────────────────

      const htmlFilename = `SAWT-${result.datFilename.replace(".DAT", "")}-${clientLabel}.html`;
      const htmlWithPrint = result.html.replace("</body>", `<script>window.onload=function(){window.print();}<\/script></body>`);
      if (dirHandle) {
        await writeFileToDir(dirHandle, result.datFilename, result.datContent, "text/plain");
        await writeFileToDir(dirHandle, htmlFilename, htmlWithPrint, "text/html");
      } else {
        fallbackDownload(`${folderName}_${result.datFilename}`, result.datContent, "text/plain");
        await new Promise(r => setTimeout(r, 400));
        fallbackDownload(`${folderName}_${htmlFilename}`, htmlWithPrint, "text/html");
        await new Promise(r => setTimeout(r, 800));
      }
    }

    // ── Make email queue available to the UI ─────────────────────────────────
    setBatchEmailClients(emailQueue);
    // ────────────────────────────────────────────────────────────────────────

    setBatchGenerating(false);
    setBatchStatus("");
  };

  const computeSummary = async (client: any) => {
    setSelected(client); setListOpen(false); setActiveQuarter("Q1"); setLoading(true);
    try {
      const { data: uploads } = await supabase.from("uploads").select("*").eq("status", "extracted");
      const forms2307 = (uploads || []).filter(u => {
        const data = parseExtractedData(u.extracted_data);
        return data?.payee_tin?.replace(/\D/g, "").includes(client.tin?.replace(/\D/g, "") || "NOMATCH") || data?.payee_name?.toLowerCase().includes(client.name.toLowerCase());
      });
      const { data: credits } = await supabase.from("prior_year_credits").select("*").eq("client_id", client.id).eq("year", parseInt(year) - 1);
      const priorCredit = credits?.reduce((sum: number, c: any) => sum + (c.excess_credit || 0), 0) || 0;
      const { data: payments } = await supabase.from("tax_payments").select("*").eq("client_id", client.id).eq("year", parseInt(year));
      const quarters: Record<string, ExtractedForm[]> = { Q1: [], Q2: [], Q3: [], Q4: [] };
      forms2307.forEach(u => {
        const data = parseExtractedData(u.extracted_data);
        const period = data?.period_to || data?.period_from || "";
        const month = parseInt(period.split("/")[0]) || 0;
        if (month >= 1 && month <= 3) quarters.Q1.push(data);
        else if (month >= 4 && month <= 6) quarters.Q2.push(data);
        else if (month >= 7 && month <= 9) quarters.Q3.push(data);
        else if (month >= 10 && month <= 12) quarters.Q4.push(data);
      });
      let cumulativeIncome = 0, cumulativeCWT = 0, previousPaid = 0;
      const EXEMPTION = 250000;
      const qSummaries = [];
      for (const [q, forms] of Object.entries(quarters)) {
        const qNum = parseInt(q.replace("Q", ""));
        const item47 = forms.reduce((sum, f) => sum + parseAmount(f?.total_income), 0);
        const item50 = cumulativeIncome, item51 = item47 + item50, item52 = EXEMPTION, item53 = item51 - item52;
        const item54 = Math.max(0, item53 * 0.08), item55 = priorCredit, item56 = previousPaid, item57 = cumulativeCWT;
        const item58 = forms.reduce((sum, f) => sum + parseAmount(f?.total_tax_withheld), 0);
        const item62 = item55 + item56 + item57 + item58, item63 = item54 - item62;
        const qPayment = payments?.find((p: any) => p.quarter === qNum)?.amount_paid || 0;
        qSummaries.push({ quarter: q, forms: forms.length, item47, item49: item47, item50, item51, item52, item53, item54, item55, item56, item57, item58, item62, item63, paid: qPayment, isOverpayment: item63 < 0, isNoTaxDue: item54 === 0 && item63 <= 0, rawForms: forms });
        cumulativeIncome = item51; cumulativeCWT += item58; previousPaid += qPayment;
      }
      setSummary({ client, quarters: qSummaries, totalForms: forms2307.length, priorCredit });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fmt = (n: number) => `₱${fmtPeso(Math.abs(n))}`;
  const clients8 = clients.filter(c => (!c.tax_type || c.tax_type === "8%") && (c.name.toLowerCase().includes(search.toLowerCase()) || (c.tin || "").includes(search)));
  const clientsGrad = clients.filter(c => c.tax_type === "graduated" && (c.name.toLowerCase().includes(search.toLowerCase()) || (c.tin || "").includes(search)));
  const totalPages8 = Math.ceil(clients8.length / PAGE_SIZE), totalPagesGrad = Math.ceil(clientsGrad.length / PAGE_SIZE);
  const pagedClients8 = clients8.slice((page8 - 1) * PAGE_SIZE, page8 * PAGE_SIZE);
  const pagedClientsGrad = clientsGrad.slice((pageGrad - 1) * PAGE_SIZE, pageGrad * PAGE_SIZE);
  const showList = listOpen || search.length > 0;
  const activeQ = summary?.quarters.find((q: any) => q.quarter === activeQuarter);
  const drawerOpen = !!editingClient;

  const renderClientList = (list: any[], page: number, totalPages: number, setPage: (fn: (p: number) => number) => void) => (
    <div>
      {list.length === 0
        ? <p style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{search ? "No clients match your search." : "No clients yet."}</p>
        : list.map(client => (
          <div key={client.id} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
            <div onClick={() => { computeSummary(client); setSearch(""); }} style={{ padding: "11px 16px", cursor: "pointer", background: selected?.id === client.id ? "rgba(99,102,241,0.1)" : "transparent", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{client.tin || "No TIN"}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); openEdit(client); }} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginLeft: 8 }}>Edit</button>
            </div>
          </div>
        ))}
      {totalPages > 1 && (
        <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: page === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: page === 1 ? "default" : "pointer", fontFamily: "inherit" }}>Prev</button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: page === totalPages ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: page === totalPages ? "default" : "pointer", fontFamily: "inherit" }}>Next</button>
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
      {batchModal && <BatchSAWTModal quarter={batchModal.quarter} yearStr={year} clientsWithForms={batchModal.clientsWithForms} onClose={() => setBatchModal(null)} onConfirm={runBatchGenerate} />}

      {/* Batch generating progress toast */}
      {batchGenerating && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998, padding: "12px 18px", background: "#1a1a1a", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          <i className="ti ti-loader-2" style={{ fontSize: 16, color: "#a5b4fc" }} />
          <p style={{ fontSize: 13, color: "#fff" }}>{batchStatus || "Generating batch SAWT files…"}</p>
        </div>
      )}

      {/* "Ready to send" toast — appears after batch generate completes */}
      {batchEmailClients.length > 0 && !batchEmailSending && !batchEmailStatus && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998, padding: "14px 18px", background: "#1a1a1a", border: "0.5px solid rgba(59,130,246,0.35)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: 400 }}>
          <i className="ti ti-mail" style={{ fontSize: 18, color: "#93c5fd", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{batchEmailClients.length} DAT file{batchEmailClients.length !== 1 ? "s" : ""} ready</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Send all to BIR eSubmission?</p>
          </div>
          <button
            onClick={handleBatchSendEmail}
            style={{ padding: "7px 14px", background: "rgba(59,130,246,0.2)", border: "0.5px solid rgba(59,130,246,0.4)", borderRadius: 8, color: "#93c5fd", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}
          >
            <i className="ti ti-send" style={{ fontSize: 12 }} /> Send All
          </button>
          <button
            onClick={() => setBatchEmailClients([])}
            style={{ width: 26, height: 26, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0 }}
          >✕</button>
        </div>
      )}

      {/* Sending progress / done toast */}
      {(batchEmailSending || batchEmailStatus) && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998, padding: "12px 18px", background: "#1a1a1a", border: `0.5px solid ${batchEmailSending ? "rgba(59,130,246,0.3)" : "rgba(16,185,129,0.3)"}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: 400 }}>
          <i
            className={`ti ti-${batchEmailSending ? "loader-2" : "circle-check"}`}
            style={{ fontSize: 16, color: batchEmailSending ? "#93c5fd" : "#6ee7b7", flexShrink: 0 }}
          />
          <p style={{ fontSize: 13, color: "#fff" }}>{batchEmailStatus || "Sending emails…"}</p>
        </div>
      )}

      <div style={{ display: "flex", minHeight: "100vh", transition: "all 0.25s ease" }}>
        <div style={{ flex: 1, minWidth: drawerOpen ? "900px" : "0", transition: "margin-right 0.25s ease", marginRight: drawerOpen ? "320px" : "0" }}>
          <main style={{ minHeight: "100vh", background: "#0f0f0f", backgroundImage: "radial-gradient(circle at top left, rgba(99,102,241,0.08) 0%, transparent 40%)", padding: "2rem 1.5rem", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>

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
                <button onClick={() => setShowValidator(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(16,185,129,0.1)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 10, color: "#6ee7b7", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  <i className="ti ti-shield-check" style={{ fontSize: 14 }} /> Validate DAT
                </button>
                <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none" }}>
                  <i className="ti ti-arrow-left" style={{ fontSize: 14 }} /> Back to Dashboard
                </Link>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
                <label style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Tax Year:</label>
                <select value={year} onChange={e => setYear(e.target.value)} style={{ padding: "8px 12px", background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>

                <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", alignSelf: "start" }}>
                  <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Clients ({clients.length})</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setListOpen(!listOpen); setSearch(""); }} style={{ padding: "5px 10px", background: listOpen ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", border: `0.5px solid ${listOpen ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: listOpen ? "#a5b4fc" : "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                        <i className="ti ti-list" style={{ fontSize: 13 }} />
                      </button>
                      <button onClick={() => setShowAddClient(!showAddClient)} style={{ padding: "5px 10px", background: "rgba(99,102,241,0.2)", border: "0.5px solid rgba(99,102,241,0.35)", borderRadius: 8, color: "#a5b4fc", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
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
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: activeQ.forms > 0 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", color: activeQ.forms > 0 ? "#6ee7b7" : "rgba(255,255,255,0.3)", border: `0.5px solid ${activeQ.forms > 0 ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}` }}>
                                    {activeQ.forms} 2307{activeQ.forms !== 1 ? "s" : ""}
                                  </span>
                                  {activeQ.forms > 0 && (
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button onClick={() => handleGenerateSAWT(summary.client, parseInt(activeQ.quarter.replace("Q", "")), activeQ.rawForms)} style={{ padding: "4px 12px", background: "rgba(16,185,129,0.15)", border: "0.5px solid rgba(16,185,129,0.3)", borderRadius: 8, color: "#6ee7b7", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                                        <i className="ti ti-file-download" style={{ fontSize: 12 }} /> Generate SAWT
                                      </button>
                                      <button onClick={() => handleSendEmail(summary.client, parseInt(activeQ.quarter.replace("Q", "")), activeQ.rawForms)} style={{ padding: "4px 12px", background: "rgba(59,130,246,0.15)", border: "0.5px solid rgba(59,130,246,0.3)", borderRadius: 8, color: "#93c5fd", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                                        <i className="ti ti-send" style={{ fontSize: 12 }} /> Send to eSubmission
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {sendStatus && (
                                  <div style={{ fontSize: 11, color: "#6ee7b7" }}>
                                    {sendStatus}
                                  </div>
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
                  {isDeleted
                    ? <button onClick={() => setDeletedPayments(prev => prev.filter(n => n !== qNum))} style={{ padding: "8px 10px", background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#a5b4fc", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Undo</button>
                    : <button onClick={() => clearPayment(qNum)} style={{ padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#fca5a5", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>✕</button>
                  }
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
