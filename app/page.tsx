"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Client {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientsLoading, setClientsLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, first_name, last_name")
        .order("last_name", { ascending: true });
      setClients(data || []);
      setClientsLoading(false);
    };
    fetchClients();
  }, []);

  const getClientDisplayName = (client: Client) => {
    if (client.last_name && client.first_name) {
      return `${client.last_name}, ${client.first_name}`;
    }
    return client.name;
  };

  const checkDuplicates = async (fileList: File[]) => {
    try {
      const res = await fetch("/api/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNames: fileList.map(f => f.name) }),
      });
      const data = await res.json();
      setDuplicates(data.duplicates || []);
    } catch {
      setDuplicates([]);
    }
  };

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const MAX_SIZE = 4.5 * 1024 * 1024;
    const oversized: string[] = [];
    const valid: File[] = [];
    Array.from(newFiles).forEach(f => {
      if (f.size > MAX_SIZE) oversized.push(`${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`);
      else valid.push(f);
    });
    if (oversized.length > 0) alert(`These files exceed the 4.5MB limit and were skipped:\n\n${oversized.join("\n")}\n\nPlease compress or split them before uploading.`);
    const updated = [...files, ...valid];
    setFiles(updated);
    checkDuplicates(updated);
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    checkDuplicates(updated);
  };

  const removeDuplicates = () => {
    const updated = files.filter(f => !duplicates.includes(f.name));
    setFiles(updated);
    setDuplicates([]);
  };

  const handleUpload = async () => {
    if (files.length === 0 || !selectedClientId) return;
    setUploading(true);
    setProgress([]);
    const results: string[] = new Array(files.length).fill("");
    const BATCH_SIZE = 5;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (file, batchIdx) => {
        const idx = i + batchIdx;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("client_id", selectedClientId);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          results[idx] = data.success
            ? `✅ ${file.name}`
            : (data.error === "duplicate" || data.message?.includes("already"))
            ? `⚠️ ${file.name} — already uploaded, skipped`
            : `❌ ${file.name} — failed`;
        } catch {
          results[idx] = `❌ ${file.name} — error`;
        }
        setProgress([...results.filter(r => r !== "")]);
      }));
    }

    setUploading(false);
    if (results.every(r => r.startsWith("✅") || r.startsWith("⚠️"))) setSuccess(true);
    setFiles([]);
    setDuplicates([]);
  };

  const iconMap: Record<string, string> = {
    pdf: "📄", xlsx: "📊", xls: "📊", csv: "📊",
    docx: "📝", doc: "📝", png: "🖼️", jpg: "🖼️", jpeg: "🖼️",
  };

  const hasDuplicates = files.some(f => duplicates.includes(f.name));
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const canUpload = files.length > 0 && !!selectedClientId && !uploading;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes checkPop { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .client-option:hover { background: rgba(99,102,241,0.08) !important; }
      `}</style>

      <main style={{
        minHeight: "100vh",
        background: "#0f0f0f",
        backgroundImage: "radial-gradient(circle at top left, rgba(99,102,241,0.12) 0%, transparent 40%), radial-gradient(circle at bottom right, rgba(20,184,166,0.08) 0%, transparent 40%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        fontFamily: "'Inter', sans-serif",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "2.5rem", animation: "fadeUp 0.5s ease both" }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-inbox" style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>Asikaso</span>
          <span style={{ fontSize: 10, background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.5px" }}>BETA</span>
        </div>

        <div style={{
          background: "#1a1a1a",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 24,
          padding: "2.5rem",
          width: "100%",
          maxWidth: 480,
          animation: "fadeUp 0.5s 0.1s ease both",
        }}>

          {success ? (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ width: 60, height: 60, background: "rgba(20,184,166,0.15)", border: "0.5px solid rgba(20,184,166,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", animation: "checkPop 0.4s ease both" }}>
                <i className="ti ti-check" style={{ fontSize: 26, color: "#14b8a6" }} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 8, letterSpacing: "-0.3px" }}>Documents received</p>
              {selectedClient && (
                <p style={{ fontSize: 13, color: "rgba(99,102,241,0.8)", marginBottom: 8, fontWeight: 500 }}>
                  Filed under: {getClientDisplayName(selectedClient)}
                </p>
              )}
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: "2rem", lineHeight: 1.6 }}>
                Your files are being processed. We&apos;ll extract and organize the data automatically.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "2rem", textAlign: "left" }}>
                {[
                  { icon: "ti-check", label: "Files uploaded", sub: "Stored securely in encrypted storage", color: "rgba(20,184,166,0.15)", textColor: "#14b8a6", done: true },
                  { icon: "2", label: "AI extraction", sub: "Claude is reading and extracting your data", color: "rgba(99,102,241,0.2)", textColor: "#a5b4fc", done: false },
                  { icon: "3", label: "Ready for review", sub: "Data organized and available in dashboard", color: "rgba(255,255,255,0.05)", textColor: "rgba(255,255,255,0.3)", done: false },
                ].map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: step.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: step.textColor, flexShrink: 0, animation: !step.done && i === 1 ? "pulse 1.5s ease-in-out infinite" : "none" }}>
                      {step.done ? <i className={`ti ${step.icon}`} style={{ fontSize: 12 }} /> : step.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", marginBottom: 2 }}>{step.label}</p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setSuccess(false); setProgress([]); }}
                style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                ← Submit more files
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "2rem" }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px", marginBottom: 6 }}>Submit your documents</h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Upload files and we&apos;ll extract, organize, and deliver the data — automatically.</p>
              </div>

              {/* Client Selector */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>
                  Client
                </label>
                {clientsLoading ? (
                  <div style={{ padding: "11px 14px", background: "#111", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 13, color: "rgba(255,255,255,0.2)" }}>
                    Loading clients...
                  </div>
                ) : (
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      background: "#111",
                      border: `0.5px solid ${selectedClientId ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 12,
                      color: selectedClientId ? "#fff" : "rgba(255,255,255,0.3)",
                      fontSize: 13,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      outline: "none",
                      transition: "border-color 0.2s ease",
                      appearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 14px center",
                      paddingRight: 36,
                    }}
                  >
                    <option value="" disabled>Select a client...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {getClientDisplayName(client)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                onClick={() => document.getElementById("fileInput")?.click()}
                style={{
                  border: `1.5px dashed ${dragging ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 16,
                  padding: "2.5rem 1.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragging ? "rgba(99,102,241,0.04)" : "transparent",
                  transition: "all 0.2s ease",
                  marginBottom: "1.25rem",
                }}
              >
                <input id="fileInput" type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.doc,.docx" onChange={(e) => addFiles(e.target.files)} />
                <div style={{ width: 52, height: 52, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", animation: "float 3s ease-in-out infinite" }}>
                  <i className="ti ti-cloud-upload" style={{ fontSize: 22, color: "rgba(255,255,255,0.5)" }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 4 }}>Drag & drop files here</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>or click to browse — multiple files allowed</p>
                <p style={{ fontSize: 11, color: "rgba(245,158,11,0.7)", marginBottom: 14 }}>⚠️ Max 4.5MB per file</p>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                  {["PDF", "JPG / PNG", "Excel", "Word", "CSV"].map(t => (
                    <span key={t} style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 10px" }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Duplicate banner */}
              {hasDuplicates && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "0.5px solid rgba(245,158,11,0.25)", borderRadius: 12, marginBottom: "1rem" }}>
                  <p style={{ fontSize: 12, color: "#fcd34d" }}>⚠️ {duplicates.length} duplicate file{duplicates.length > 1 ? "s" : ""} detected</p>
                  <button onClick={removeDuplicates} style={{ fontSize: 12, color: "#fcd34d", background: "rgba(245,158,11,0.15)", border: "0.5px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                    Remove all
                  </button>
                </div>
              )}

              {/* File list */}
              {files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.25rem", maxHeight: 280, overflowY: "auto" }}>
                  {files.map((file, i) => {
                    const ext = file.name.split(".").pop()?.toLowerCase() || "";
                    const emoji = iconMap[ext] || "📄";
                    const isDup = duplicates.includes(file.name);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isDup ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.04)", borderRadius: 12, border: `0.5px solid ${isDup ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.07)"}` }}>
                        <div style={{ width: 34, height: 34, background: "rgba(255,255,255,0.06)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>{emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</p>
                          <p style={{ fontSize: 11, color: isDup ? "#fcd34d" : "rgba(255,255,255,0.3)", marginTop: 2 }}>
                            {isDup ? "⚠️ Already uploaded" : `${(file.size / 1024).toFixed(1)} KB`}
                          </p>
                        </div>
                        <button onClick={() => removeFile(i)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 18, cursor: "pointer", padding: "2px 4px" }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Progress */}
              {progress.length > 0 && (
                <div style={{ marginBottom: "1.25rem" }}>
                  {progress.map((p, i) => <p key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{p}</p>)}
                </div>
              )}

              {/* No client warning */}
              {files.length > 0 && !selectedClientId && (
                <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 12, marginBottom: "1rem" }}>
                  <p style={{ fontSize: 12, color: "rgba(239,68,68,0.8)" }}>⚠️ Please select a client before uploading</p>
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleUpload}
                disabled={!canUpload}
                style={{
                  width: "100%",
                  padding: 14,
                  background: canUpload ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.08)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: canUpload ? "pointer" : "not-allowed",
                  opacity: canUpload ? 1 : 0.4,
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                  letterSpacing: "-0.1px",
                }}
              >
                {uploading
                  ? "Uploading..."
                  : files.length > 0 && selectedClientId
                  ? `Submit ${files.length} document${files.length !== 1 ? "s" : ""} →`
                  : "Submit documents"}
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: "1.75rem", display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "rgba(255,255,255,0.2)", animation: "fadeUp 0.5s 0.2s ease both" }}>
          <span><i className="ti ti-lock" style={{ fontSize: 12, verticalAlign: "-1px", marginRight: 4 }} />Encrypted in transit</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "inline-block" }} />
          <span>Powered by Asikaso</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "inline-block" }} />
          <span>© 2026</span>
        </div>
      </main>
    </>
  );
}