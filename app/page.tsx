"use client";
import { useState } from "react";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles(prev => [...prev, ...Array.from(newFiles)]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    setProgress([]);

    const results: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) {
          results.push(`✅ ${file.name}`);
        } else {
          results.push(`❌ ${file.name} — failed`);
        }
      } catch {
        results.push(`❌ ${file.name} — error`);
      }
      setProgress([...results]);
    }

    setUploading(false);
    const allSuccess = results.every(r => r.startsWith("✅"));
    if (allSuccess) setSuccess(true);
    setFiles([]);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">DropZone</h1>
          <p className="text-gray-500 mt-1">Submit your documents for processing</p>
        </div>

        {success ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-medium text-gray-900">All documents received</p>
            <p className="text-gray-500 text-sm mt-1">We'll process them and get back to you</p>
            <button onClick={() => { setSuccess(false); setProgress([]); }} className="mt-4 text-sm text-blue-600 hover:underline">
              Submit more
            </button>
          </div>
        ) : (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              onClick={() => document.getElementById("fileInput")?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${
                dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                id="fileInput"
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.doc,.docx"
                onChange={(e) => addFiles(e.target.files)}
              />
              <p className="text-gray-500">Drag & drop documents here</p>
              <p className="text-gray-400 text-sm mt-1">or click to browse — multiple files allowed</p>
              <p className="text-gray-300 text-xs mt-2">PDF, JPG, PNG, Excel, Word</p>
            </div>

            {files.length > 0 && (
              <div className="mb-4 space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{file.name}</p>
                      <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={() => removeFile(i)} className="text-gray-300 hover:text-red-400 text-lg ml-2">×</button>
                  </div>
                ))}
              </div>
            )}

            {progress.length > 0 && (
              <div className="mb-4 space-y-1">
                {progress.map((p, i) => (
                  <p key={i} className="text-sm text-gray-600">{p}</p>
                ))}
              </div>
            )}

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? `Uploading ${progress.length + 1} of ${files.length}...` : `Submit ${files.length > 0 ? `${files.length} ` : ""}Document${files.length !== 1 ? "s" : ""}`}
            </button>
          </>
        )}
      </div>
    </main>
  );
}