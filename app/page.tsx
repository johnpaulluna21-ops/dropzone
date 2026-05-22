"use client";
import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) { setSuccess(true); setFile(null); }
      else setError("Upload failed.");
    } catch { setError("Upload failed."); }
    finally { setUploading(false); }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-lg">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">DropZone</h1>
        <p className="text-gray-500 mb-6">Submit your documents for processing</p>
        {success ? (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-medium">Document received</p>
            <button onClick={() => setSuccess(false)} className="mt-4 text-sm text-blue-600 hover:underline">Submit another</button>
          </div>
        ) : (
          <>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer mb-4" />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button onClick={handleUpload} disabled={!file || uploading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40">
              {uploading ? "Uploading..." : "Submit Document"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}