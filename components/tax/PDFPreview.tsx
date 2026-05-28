"use client";

import { useEffect, useState } from "react";

interface PDFPreviewProps {
  uploadId: string;
  filename?: string;
}

function isImage(filename?: string): boolean {
  if (!filename) return false;
  const ext = filename.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "");
}

export function PDFPreview({ uploadId, filename }: PDFPreviewProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    setLoading(true);
    setError(null);
    setFileUrl(null);

    fetch(`/api/file/${uploadId}`)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(({ url }) => {
        setFileUrl(url);
        setLoading(false);
      })
      .catch(err => {
        console.error("[PDFPreview] failed:", err);
        setError("Failed to load document.");
        setLoading(false);
      });
  }, [uploadId]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
      Loading document...
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#fca5a5", fontSize: 13 }}>
      {error}
    </div>
  );

  if (isImage(filename)) {
    return (
      <div style={{ width: "100%", height: "100%", overflowY: "auto", padding: 12 }}>
        <img
          src={fileUrl!}
          alt={filename}
          style={{ width: "100%", height: "auto", borderRadius: 8, display: "block" }}
        />
      </div>
    );
  }

  return (
    <iframe
      src={fileUrl!}
      style={{ width: "100%", height: "100%", border: "none", borderRadius: 8 }}
      title="PDF Preview"
    />
  );
}