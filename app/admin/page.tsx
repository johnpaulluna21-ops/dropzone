/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
  const [uploads, setUploads] = useState<any[]>([]);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    fetchUploads();
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

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">All submitted documents</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">File</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {uploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{upload.file_name}</p>
                      <p className="text-xs text-gray-400">{(upload.file_size / 1024).toFixed(1)} KB</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        upload.status === "extracted"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {upload.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => upload.extracted_data ? setSelected(upload) : handleExtract(upload)}
                        disabled={extracting === upload.id}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40"
                      >
                        {extracting === upload.id ? "Extracting..." : upload.extracted_data ? "View" : "Extract"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            {selected ? (
              <>
                <h2 className="font-medium text-gray-900 mb-4">{selected.file_name}</h2>
                <pre className="text-xs bg-gray-50 rounded-xl p-4 overflow-auto max-h-96 text-gray-700">
                  {JSON.stringify(
  typeof selected.extracted_data === "string"
    ? JSON.parse(selected.extracted_data)
    : selected.extracted_data,
  null,
  2
)}
                </pre>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Click Extract on a document to see results
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}