/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
  const [uploads, setUploads] = useState<any[]>([]);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [bulkExtracting, setBulkExtracting] = useState(false);

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

  const handleExtractSelected = async () => {
    const toExtract = uploads.filter(
      (u) => checked.includes(u.id) &&
      (!u.extracted_data || hasParseError(u.extracted_data))
    );
    if (toExtract.length === 0) return alert("All selected files are already extracted cleanly.");
    if (!confirm(`Extract ${toExtract.length} file(s)?`)) return;
    setBulkExtracting(true);
    for (const upload of toExtract) {
      await handleExtract(upload);
    }
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
        "File Name": u.file_name,
        "Status": u.status,
        "Document Type": data.document_type || "",
        "Date": data.date || "",
        "Amount": data.amount || "",
        "Name": data.name || "",
        "Address": data.address || "",
        "Uploaded At": new Date(u.created_at).toLocaleString(),
        ...Object.fromEntries(
          Object.entries(data)
            .filter(([k]) => !["document_type","date","amount","name","address"].includes(k))
            .map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v])
        ),
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

  const toggleCheck = (id: string) => {
    setChecked(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setChecked(checked.length === uploads.length ? [] : uploads.map(u => u.id));
  };

  const parseExtractedData = (data: any) => {
    try {
      let parsed = data;
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed;
    } catch {
      return data;
    }
  };

  const hasParseError = (data: any) => {
    const parsed = parseExtractedData(data);
    return parsed?.parse_error === true;
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500 mt-1">All submitted documents</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportAll}
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700"
            >
              Export All
            </button>
            {checked.length > 0 && (
              <>
                <button
                  onClick={handleExtractSelected}
                  disabled={bulkExtracting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
                >
                  {bulkExtracting ? "Extracting..." : `Extract ${checked.length} selected`}
                </button>
                <button
                  onClick={handleExportSelected}
                  className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-600"
                >
                  Export {checked.length} selected
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-40"
                >
                  {deleting ? "Deleting..." : `Delete ${checked.length} selected`}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked.length === uploads.length && uploads.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">File</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {uploads.map((upload) => (
                  <tr key={upload.id} className={`hover:bg-gray-50 ${checked.includes(upload.id) ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked.includes(upload.id)}
                        onChange={() => toggleCheck(upload.id)}
                        className="rounded"
                      />
                    </td>
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
                      <div className="flex flex-col gap-1">
                        {upload.extracted_data && (
                          <button
                            onClick={() => setSelected(upload)}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                          >
                            View
                          </button>
                        )}
                        <button
                          onClick={() => handleExtract(upload)}
                          disabled={extracting === upload.id}
                          className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 ${
                            upload.extracted_data
                              ? hasParseError(upload.extracted_data)
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {extracting === upload.id
                            ? "Extracting..."
                            : upload.extracted_data
                            ? "Re-run"
                            : "Extract"}
                        </button>
                      </div>
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
                  {JSON.stringify(parseExtractedData(selected.extracted_data), null, 2)}
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