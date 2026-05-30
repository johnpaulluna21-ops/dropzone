"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface Client {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
}

function formatTin(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 9),
    digits.slice(9, 13),
  ].filter(Boolean);
  return parts.join("-");
}

export default function UploadWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientsLoading, setClientsLoading] = useState(true);

  // Create client form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tin, setTin] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, name, first_name, last_name")
      .order("last_name", { ascending: true });
    const clientList = data || [];
    setClients(clientList);
    if (clientList.length === 1) {
      setSelectedClientId(clientList[0].id);
    }
    setClientsLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!firstName.trim() || !lastName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        tin: tin || null,
        user_id: user.id,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      setCreateError(result.error || "Something went wrong");
      setCreating(false);
      return;
    }

    // Reset form, reload clients
    setFirstName("");
    setLastName("");
    setTin("");
    setShowCreateForm(false);
    setCreating(false);
    setClientsLoading(true);
    await fetchClients();
  };

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
    if (oversized.length > 0) alert(`These files exceed the 4.5MB limit:\n\n${oversized.join("\n")}`);
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

  // ─── Empty state: no clients yet ───────────────────────────────────────────
  if (!clientsLoading && clients.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
        {!showCreateForm ? (
          <>
            <div style={{
              width: 52, height: 52,
              background: "rgba(99,102,241,0.1)",
              border: "0.5px solid rgba(99,102,241,0.2)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1.25rem", fontSize: 22,
            }}>👤</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
              Add your first client
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              You need at least one client before uploading documents.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff", border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + Create client
            </button>
          </>
        ) : (
          <form onSubmit={handleCreateClient} style={{ textAlign: "left" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: "1.25rem" }}>
              New client
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 5 }}>
                  Last Name *
                </label>
                <input
                  type="text" value={lastName} required
                  onChange={e => setLastName(e.target.value)}
                  placeholder="dela Cruz"
                  style={{ width: "100%", padding: "10px 13px", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 5 }}>
                  First Name *
                </label>
                <input
                  type="text" value={firstName} required
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Juan"
                  style={{ width: "100%", padding: "10px 13px", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 5 }}>
                  TIN <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>optional</span>
                </label>
                <input
                  type="text" value={tin}
                  onChange={e => setTin(formatTin(e.target.value))}
                  placeholder="000-000-000-0000" maxLength={17}
                  style={{ width: "100%", padding: "10px 13px", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", letterSpacing: "1px" }}
                />
              </div>
              {createError && (
                <p style={{ fontSize: 12, color: "rgba(239,68,68,0.8)", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}>
                  {createError}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setCreateError(null); }}
                  style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={creating || !firstName || !lastName}
                  style={{ flex: 2, padding: "10px", background: creating || !firstName || !lastName ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: creating || !firstName || !lastName ? "rgba(255,255,255,0.25)" : "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: creating || !firstName || !lastName ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                >
                  {creating ? "Creating..." : "Create client →"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    );
  }

  // ─── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <div style={{
          width: 60, height: 60,
          background: "rgba(20,184,166,0.15)",
          border: "0.5px solid rgba(20,184,166,0.25)",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 1.5rem",
        }}>
          <span style={{ fontSize: 24 }}>✓</span>
        </div>
        <p style={{ fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
          Documents received
        </p>
        {selectedClient && (
          <p style={{ fontSize: 13, color: "rgba(99,102,241,0.8)", marginBottom: 8, fontWeight: 500 }}>
            Filed under: {getClientDisplayName(selectedClient)}
          </p>
        )}
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: "2rem", lineHeight: 1.6 }}>
          Files are being processed by AI extraction.
        </p>
        <button
          onClick={() => { setSuccess(false); setProgress([]); }}
          style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          ← Upload more files
        </button>
      </div>
    );
  }

  // ─── Normal upload state ────────────────────────────────────────────────────
  return (
    <div>
      {/* Client Selector — show if multiple clients */}
      {clients.length > 1 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>
            Client
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={{
              width: "100%", padding: "11px 14px",
              background: "#111",
              border: `0.5px solid ${selectedClientId ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 12,
              color: selectedClientId ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 13, fontFamily: "inherit", cursor: "pointer",
              outline: "none", appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36,
            }}
          >
            <option value="" disabled>Select a client...</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {getClientDisplayName(client)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => document.getElementById("fileInputDashboard")?.click()}
        style={{
          border: `1.5px dashed ${dragging ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`,
          borderRadius: 16, padding: "2rem 1.5rem", textAlign: "center",
          cursor: "pointer",
          background: dragging ? "rgba(99,102,241,0.04)" : "transparent",
          transition: "all 0.2s ease", marginBottom: "1.25rem",
        }}
      >
        <input id="fileInputDashboard" type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.doc,.docx" onChange={(e) => addFiles(e.target.files)} />
        <div style={{ fontSize: 28, marginBottom: 10 }}>☁️</div>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 4 }}>Drag & drop files here</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>or click to browse — multiple files allowed</p>
        <p style={{ fontSize: 11, color: "rgba(245,158,11,0.7)" }}>⚠️ Max 4.5MB per file</p>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
          {["PDF", "JPG / PNG", "Excel", "Word", "CSV"].map(t => (
            <span key={t} style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Duplicate banner */}
      {hasDuplicates && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "0.5px solid rgba(245,158,11,0.25)", borderRadius: 12, marginBottom: "1rem" }}>
          <p style={{ fontSize: 12, color: "#fcd34d" }}>⚠️ {duplicates.length} duplicate file{duplicates.length > 1 ? "s" : ""} detected</p>
          <button onClick={removeDuplicates} style={{ fontSize: 12, color: "#fcd34d", background: "rgba(245,158,11,0.15)", border: "0.5px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>Remove all</button>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.25rem", maxHeight: 240, overflowY: "auto" }}>
          {files.map((file, i) => {
            const ext = file.name.split(".").pop()?.toLowerCase() || "";
            const emoji = iconMap[ext] || "📄";
            const isDup = duplicates.includes(file.name);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isDup ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.04)", borderRadius: 12, border: `0.5px solid ${isDup ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.07)"}` }}>
                <div style={{ width: 34, height: 34, background: "rgba(255,255,255,0.06)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>{emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</p>
                  <p style={{ fontSize: 11, color: isDup ? "#fcd34d" : "rgba(255,255,255,0.3)", marginTop: 2 }}>{isDup ? "⚠️ Already uploaded" : `${(file.size / 1024).toFixed(1)} KB`}</p>
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
          {progress.map((p, i) => (
            <p key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{p}</p>
          ))}
        </div>
      )}

      {/* No client warning */}
      {files.length > 0 && !selectedClientId && clients.length > 1 && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 12, marginBottom: "1rem" }}>
          <p style={{ fontSize: 12, color: "rgba(239,68,68,0.8)" }}>⚠️ Please select a client before uploading</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleUpload}
        disabled={!canUpload}
        style={{
          width: "100%", padding: 14,
          background: canUpload ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.08)",
          color: canUpload ? "#fff" : "rgba(255,255,255,0.25)",
          border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600,
          cursor: canUpload ? "pointer" : "not-allowed",
          fontFamily: "inherit", letterSpacing: "-0.1px", transition: "all 0.2s ease",
        }}
      >
        {uploading ? "Uploading..." : files.length > 0 && selectedClientId ? `Submit ${files.length} document${files.length !== 1 ? "s" : ""} →` : "Submit documents"}
      </button>
    </div>
  );
}