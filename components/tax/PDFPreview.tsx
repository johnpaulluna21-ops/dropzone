"use client";

import { useEffect, useRef, useState } from "react";

interface PDFPreviewProps {
  uploadId: string;
}

export function PDFPreview({ uploadId }: PDFPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfRef = useRef<any>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    if (!uploadId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setCurrentPage(1);
      pdfRef.current = null;
      try {
        const res = await fetch(`/api/file/${uploadId}`);
        if (!res.ok) throw new Error("Failed to fetch signed URL");
        const { url } = await res.json();
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";
        const pdfDoc = await pdfjsLib.getDocument({ url, cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/", cMapPacked: true }).promise;
        if (!cancelled) { pdfRef.current = pdfDoc; setTotalPages(pdfDoc.numPages); setLoading(false); }
      } catch { if (!cancelled) { setError("Failed to load document."); setLoading(false); } }
    }
    load();
    return () => { cancelled = true; };
  }, [uploadId]);

  useEffect(() => {
    if (!pdfRef.current || !canvasRef.current || loading) return;
    let cancelled = false;
    async function renderPage() {
      if (!pdfRef.current || !canvasRef.current) return;
      if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
      try {
        const page = await pdfRef.current.getPage(currentPage);
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        const containerWidth = canvas.parentElement?.clientWidth ?? 500;
        const viewport = page.getViewport({ scale: 1 });
        const scaledViewport = page.getViewport({ scale: containerWidth / viewport.width });
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const renderTask = page.render({ canvasContext: context, viewport: scaledViewport, canvas });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (err: any) { if (err?.name !== "RenderingCancelledException") console.error(err); }
    }
    renderPage();
    return () => { cancelled = true; if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; } };
  }, [currentPage, loading]);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading document...</div>;
  if (error) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#fca5a5", fontSize: 13 }}>{error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} style={{ padding: "4px 10px", fontSize: 12, background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.7)", cursor: currentPage <= 1 ? "default" : "pointer", opacity: currentPage <= 1 ? 0.3 : 1 }}>Prev</button>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Page {currentPage} of {totalPages}</span>
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={{ padding: "4px 10px", fontSize: 12, background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.7)", cursor: currentPage >= totalPages ? "default" : "pointer", opacity: currentPage >= totalPages ? 0.3 : 1 }}>Next</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        <canvas ref={canvasRef} style={{ width: "100%", display: "block", borderRadius: 8 }} />
      </div>
    </div>
  );
}