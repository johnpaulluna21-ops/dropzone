"use client";
import { useState } from "react";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

 const addFiles = (newFiles: FileList | null) => {
  if (!newFiles) return;
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  const oversized: string[] = [];
  const valid: File[] = [];
  Array.from(newFiles).forEach(f => {
    if (f.size > MAX_SIZE) oversized.push(f.name);
    else valid.push(f);
  });
  if (oversized.length > 0) alert(`These files exceed the 50MB limit and were skipped:\n${oversized.join("\n")}`);
  setFiles(prev => [...prev, ...valid]);
};

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress([]);
    const results: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        results.push(data.success ? `✅ ${file.name}` : data.error === "duplicate" ? `⚠️ ${file.name} — already uploaded` : `❌ ${file.name} — failed`);
      } catch {
        results.push(`❌ ${file.name}`);
      }
      setProgress([...results]);
    }
    setUploading(false);
    if (results.every(r => r.startsWith("✅"))) setSuccess(true);
    setFiles([]);
  };

  const iconMap: Record<string, string> = {
    pdf: "📄", xlsx: "📊", xls: "📊", csv: "📊",
    docx: "📝", doc: "📝", png: "🖼️", jpg: "🖼️", jpeg: "🖼️",
  };

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
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
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
        position: "relative",
        overflow: "hidden",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "2.5rem", animation: "fadeUp 0.5s ease both" }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-inbox" style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>DropZone</span>
          <span style={{ fontSize: 10, background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.5px" }}>BETA</span>
        </div>

        {/* Card */}
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
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: "2rem", lineHeight: 1.6 }}>Your files are being processed. we&apos;ll extract and organize the data automatically.</p>

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

              <button onClick={() => { setSuccess(false); setProgress([]); }} style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                ← Submit more files
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "2rem" }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px", marginBottom: 6 }}>Submit your documents</h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Upload files and we&apos;ll extract, organize, and deliver the data — automatically.</p>
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
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>or click to browse — multiple files allowed</p>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                  {["PDF", "JPG / PNG", "Excel", "Word", "CSV"].map(t => (
                    <span key={t} style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 10px" }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.25rem" }}>
                  {files.map((file, i) => {
                    const ext = file.name.split(".").pop()?.toLowerCase() || "";
                    const emoji = iconMap[ext] || "📄";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ width: 34, height: 34, background: "rgba(255,255,255,0.06)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>{emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</p>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={() => removeFile(i)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 18, cursor: "pointer", padding: "2px 4px", transition: "color 0.15s" }}>×</button>
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

              {/* Submit */}
              <button
                onClick={handleUpload}
                disabled={files.length === 0 || uploading}
                style={{
                  width: "100%",
                  padding: 14,
                  background: files.length === 0 || uploading ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: files.length === 0 || uploading ? "not-allowed" : "pointer",
                  opacity: files.length === 0 || uploading ? 0.4 : 1,
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                  letterSpacing: "-0.1px",
                }}
              >
                {uploading ? `Uploading ${progress.length + 1} of ${files.length}...` : files.length > 0 ? `Submit ${files.length} document${files.length !== 1 ? "s" : ""} →` : "Submit documents"}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "1.75rem", display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "rgba(255,255,255,0.2)", animation: "fadeUp 0.5s 0.2s ease both" }}>
          <span><i className="ti ti-lock" style={{ fontSize: 12, verticalAlign: "-1px", marginRight: 4 }} />Encrypted in transit</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "inline-block" }} />
          <span>Powered by DropZone</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "inline-block" }} />
          <span>© 2026</span>
        </div>
      </main>
    </>
  );
}