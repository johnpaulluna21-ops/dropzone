/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAGE_SIZE = 20;

export default function AdminPage() {
  const [uploads, setUploads] = useState<any[]>([]);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [bulkExtracting, setBulkExtracting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    fetchUploads();
    const channel = supabase
      .channel("uploads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "uploads" }, () => {
        fetchUploads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUploads = async () => {
    const { data } = await supabase
      .from("uploads")
      .select("*")
      .order("created_at", { ascending: false });
    setUploads(data || []);
  };

  const handleExtract = async (upload: any) => {
    setExtracting(upload.id);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: upload.id }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected({ ...upload, extracted_data: data.data });
        fetchUploads();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExtracting(null);
    }
  };

  const handleExtractSelected = async () => {
    const toExtract = uploads.filter(
      (u) => checked.includes(u.id) && (!u.extracted_data || hasParseError(u.extracted_data))
    );
    if (toExtract.length === 0) return alert("All selected files are already extracted cleanly.");
    if (!confirm(`Extract ${toExtract.length} file(s)?`)) return;
    setBulkExtracting(true);
    for (const upload of toExtract) { await handleExtract(upload); }
    setBulkExtracting(false);
    setChecked([]);
  };

  const handleForceRerunSelected = async () => {
    const toRerun = uploads.filter((u) => checked.includes(u.id));
    if (toRerun.length === 0) return;
    if (!confirm(`Force re-run ${toRerun.length} file(s)? This will overwrite existing data.`)) return;
    setBulkExtracting(true);
    for (const upload of toRerun) { await handleExtract(upload); }
    setBulkExtracting(false);
    setChecked([]);
  };

  const handleDelete = async () => {
    if (checked.length === 0) return;
    if (!confirm(`Delete ${checked.length} file(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: checked }),
      });
      const data = await res.json();
      if (data.success) {
        setChecked([]);
        if (selected && checked.includes(selected.id)) setSelected(null);
        fetchUploads();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const exportToExcel = (rows: any[], filename: string) => {
    const exportData = rows.map((u) => {
      const data = parseExtractedData(u.extracted_data) || {};
      return {
        "File Name": u.file_name, "Status": u.status,
        "Document Type": data.document_type || "", "Date": data.date || "",
        "Amount": data.amount || "", "Name": data.name || "",
        "Address": data.address || "", "Uploaded At": new Date(u.created_at).toLocaleString(),
        ...Object.fromEntries(Object.entries(data).filter(([k]) => !["document_type","date","amount","name","address"].includes(k)).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v])),
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documents");
    XLSX.writeFile(wb, filename);
  };

  const handleExportSelected = () => {
    const rows = uploads.filter((u) => checked.includes(u.id) && u.extracted_data);
    if (rows.length === 0) return alert("No extracted files selected.");
    exportToExcel(rows, `dropzone_selected_${Date.now()}.xlsx`);
  };

  const handleExportAll = () => {
    const rows = uploads.filter((u) => u.extracted_data);
    if (rows.length === 0) return alert("No extracted files to export.");
    exportToExcel(rows, `dropzone_all_${Date.now()}.xlsx`);
  };

  const toggleCheck = (id: string, idx: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastCheckedRef.current) {
      const lastIdx = paginatedUploads.findIndex(u => u.id === lastCheckedRef.current);
      if (lastIdx !== -1) {
        const start = Math.min(lastIdx, idx);
        const end = Math.max(lastIdx, idx);
        const rangeIds = paginatedUploads.slice(start, end + 1).map(u => u.id);
        setChecked(prev => {
          const combined = new Set([...prev, ...rangeIds]);
          return Array.from(combined);
        });
        return;
      }
    }
    lastCheckedRef.current = id;
    setChecked(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleRowClick = (upload: any, idx: number, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.closest("button")) return;
    toggleCheck(upload.id, idx, e);
  };

  const handleRowMouseDown = (idx: number) => {
    setDragStart(idx);
    setIsDragging(false);
  };

  const handleRowMouseEnter = (idx: number) => {
    if (dragStart !== null) {
      setIsDragging(true);
      setDragEnd(idx);
      const start = Math.min(dragStart, idx);
      const end = Math.max(dragStart, idx);
      const rangeIds = paginatedUploads.slice(start, end + 1).map(u => u.id);
      setChecked(prev => {
        const combined = new Set([...prev, ...rangeIds]);
        return Array.from(combined);
      });
    }
  };

  const handleMouseUp = useCallback(() => {
    setDragStart(null);
    setDragEnd(null);
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  const toggleAll = () => {
    setChecked(checked.length === filteredUploads.length ? [] : filteredUploads.map(u => u.id));
  };

  const parseExtractedData = (data: any) => {
    try {
      let parsed = data;
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed;
    } catch { return data; }
  };

  const hasParseError = (data: any) => {
    const parsed = parseExtractedData(data);
    return parsed?.parse_error === true;
  };

  const filteredUploads = uploads.filter(u => {
    const matchSearch = u.file_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filteredUploads.length / PAGE_SIZE);
  const paginatedUploads = filteredUploads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pendingCount = uploads.filter(u => checked.includes(u.id) && (!u.extracted_data || hasParseError(u.extracted_data))).length;

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #0f0f0f; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        input[type="checkbox"] { accent-color: #6366f1; width: 14px; height: 14px; cursor: pointer; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .row-selectable { cursor: pointer; user-select: none; }
        .row-selectable:hover { background: rgba(99,102,241,0.04) !important; }
      `}</style>

      <main onClick={(e) => {
  const target = e.target as HTMLElement;
  if (!target.closest("table") && !target.closest("button")) {
    setChecked([]);
  }
}} style={{
  minHeight: "100vh",
  background: "#0f0f0f",
  backgroundImage: "radial-gradient(circle at top left, rgba(99,102,241,0.08) 0%, transparent 40%), radial-gradient(circle at bottom right, rgba(20,184,166,0.05) 0%, transparent 40%)",
  padding: "2rem 1.5rem",
  fontFamily: "'Inter', sans-serif",
}}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem", animation: "fadeUp 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ti ti-layout-dashboard" style={{ color: "#fff", fontSize: 18 }} />
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>Admin Dashboard</h1>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{uploads.length} documents · {uploads.filter(u => u.status === "extracted").length} extracted</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleExportAll} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(16,185,129,0.15)", border: "0.5px solid rgba(16,185,129,0.3)", borderRadius: 10, color: "#6ee7b7", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                <i className="ti ti-table-export" style={{ fontSize: 14 }} /> Export All
              </button>
              {checked.length > 0 && (
                <>
                  <button onClick={handleExtractSelected} disabled={bulkExtracting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#a5b4fc", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", opacity: bulkExtracting ? 0.5 : 1 }}>
                    <i className="ti ti-sparkles" style={{ fontSize: 14 }} />
                    {bulkExtracting ? "Extracting..." : `Extract ${pendingCount} pending`}
                  </button>
                  <button onClick={handleForceRerunSelected} disabled={bulkExtracting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(245,158,11,0.15)", border: "0.5px solid rgba(245,158,11,0.3)", borderRadius: 10, color: "#fcd34d", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", opacity: bulkExtracting ? 0.5 : 1 }}>
                    <i className="ti ti-refresh" style={{ fontSize: 14 }} />
                    {bulkExtracting ? "Running..." : `Force Re-run ${checked.length}`}
                  </button>
                  <button onClick={handleExportSelected} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(16,185,129,0.10)", border: "0.5px solid rgba(16,185,129,0.2)", borderRadius: 10, color: "#6ee7b7", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    <i className="ti ti-download" style={{ fontSize: 14 }} /> Export {checked.length}
                  </button>
                  <button onClick={handleDelete} disabled={deleting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(239,68,68,0.12)", border: "0.5px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#fca5a5", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", opacity: deleting ? 0.5 : 1 }}>
                    <i className="ti ti-trash" style={{ fontSize: 14 }} />
                    {deleting ? "Deleting..." : `Delete ${checked.length}`}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search + Filter */}
          <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem", animation: "fadeUp 0.4s 0.05s ease both" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "rgba(255,255,255,0.3)" }} />
              <input
                type="text"
                placeholder="Search by filename..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ width: "100%", padding: "9px 12px 9px 34px", background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ padding: "9px 14px", background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "inherit", cursor: "pointer", outline: "none" }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="extracted">Extracted</option>
            </select>
          </div>

          {/* Hint */}
          {checked.length === 0 && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: "0.75rem" }}>
              💡 Click a row to select · Shift+click for range · Drag to select multiple
            </p>
          )}

          {/* Main Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, animation: "fadeUp 0.4s 0.1s ease both" }}>

            {/* Table */}
            <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
                    <th style={{ padding: "12px 16px", width: 40 }}>
                      <input type="checkbox" checked={paginatedUploads.length > 0 && paginatedUploads.every(u => checked.includes(u.id))} onChange={toggleAll} />
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px", textTransform: "uppercase" }}>File</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px", textTransform: "uppercase", width: 120 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUploads.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                        No documents found
                      </td>
                    </tr>
                  ) : paginatedUploads.map((upload, idx) => (
                    <tr
                      key={upload.id}
                      className="row-selectable"
                      onClick={(e) => handleRowClick(upload, idx, e)}
                      onMouseDown={() => handleRowMouseDown(idx)}
                      onMouseEnter={() => handleRowMouseEnter(idx)}
                      style={{
                        borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                        background: checked.includes(upload.id)
                          ? "rgba(99,102,241,0.1)"
                          : isDragging && dragStart !== null && dragEnd !== null && idx >= Math.min(dragStart, dragEnd) && idx <= Math.max(dragStart, dragEnd)
                          ? "rgba(99,102,241,0.05)"
                          : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                        transition: "background 0.1s",
                        outline: checked.includes(upload.id) ? "0.5px solid rgba(99,102,241,0.3)" : "none",
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <input type="checkbox" checked={checked.includes(upload.id)} onChange={() => {}} onClick={(e) => { e.stopPropagation(); toggleCheck(upload.id, idx, e as any); }} />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{upload.file_name}</p>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{(upload.file_size / 1024).toFixed(1)} KB</p>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: upload.status === "extracted" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                          color: upload.status === "extracted" ? "#6ee7b7" : "#fcd34d",
                          border: `0.5px solid ${upload.status === "extracted" ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`,
                        }}>
                          {upload.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {upload.extracted_data && (
                            <button onClick={(e) => { e.stopPropagation(); setSelected(upload); }} style={{ padding: "5px 12px", background: "rgba(99,102,241,0.2)", border: "0.5px solid rgba(99,102,241,0.35)", borderRadius: 8, color: "#a5b4fc", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                              View
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleExtract(upload); }} disabled={extracting === upload.id} style={{
                            padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                            opacity: extracting === upload.id ? 0.5 : 1,
                            background: upload.extracted_data ? hasParseError(upload.extracted_data) ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.2)",
                            border: upload.extracted_data ? hasParseError(upload.extracted_data) ? "0.5px solid rgba(239,68,68,0.3)" : "0.5px solid rgba(255,255,255,0.1)" : "0.5px solid rgba(99,102,241,0.35)",
                            color: upload.extracted_data ? hasParseError(upload.extracted_data) ? "#fca5a5" : "rgba(255,255,255,0.5)" : "#a5b4fc",
                          }}>
                            {extracting === upload.id ? "..." : upload.extracted_data ? "Re-run" : "Extract"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredUploads.length)} of {filteredUploads.length}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: page === 1 ? 0.4 : 1 }}>
                      ← Prev
                    </button>
                    <span style={{ padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: page === totalPages ? 0.4 : 1 }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Panel */}
            <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "1.5rem", display: "flex", flexDirection: "column" }}>
              {selected ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ width: 32, height: 32, background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.25)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="ti ti-file-text" style={{ fontSize: 16, color: "#a5b4fc" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.file_name}</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Extracted data</p>
                    </div>
                    <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18 }}>×</button>
                  </div>
                  <pre style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "1rem", overflow: "auto", flex: 1, lineHeight: 1.7, fontFamily: "monospace" }}>
                    {JSON.stringify(parseExtractedData(selected.extracted_data), null, 2)}
                  </pre>
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="ti ti-file-search" style={{ fontSize: 24, color: "rgba(255,255,255,0.2)" }} />
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>Select a document to preview extracted data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}