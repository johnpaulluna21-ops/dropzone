"use client";

import { useEffect, useState } from "react";

interface PDFPreviewProps {
  uploadId: string;
}

export function PDFPreview({ uploadId }: PDFPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    setLoading(true);
    setError(null);
    setPdfUrl(null);

    fetch(`/api/file/${uploadId}`)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(({ url }) => {
        setPdfUrl(url);
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

  return (
    <iframe
      src={pdfUrl!}
      style={{ width: "100%", height: "100%", border: "none", borderRadius: 8 }}
      title="PDF Preview"
    />
  );
}