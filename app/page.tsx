"use client";
import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [collectionLink, setCollectionLink] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles(Array.from(e.target.files));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files) setFiles(Array.from(e.dataTransfer.files));
  }

  async function handleUpload() {
    if (!files.length) return;
    setUploading(true);

    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .insert({})
      .select()
      .single();

    if (collectionError) {
      alert("Failed to create collection: " + collectionError.message);
      setUploading(false);
      return;
    }

    for (const file of files) {
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("files")
        .upload(fileName, file);

      if (error) {
        alert("Upload failed: " + error.message);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("files")
        .getPublicUrl(fileName);

      await supabase.from("files").insert({
        filename: file.name,
        filesize: file.size,
        url: urlData.publicUrl,
        collection_id: collection.id,
      });
    }

    setCollectionLink(`${window.location.origin}/share/${collection.id}`);
    setUploading(false);
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6">
        <h1 className="text-4xl font-bold text-gray-900">DropZone</h1>
        <p className="text-gray-500 text-center text-lg">
          Drop your files. Share instantly. No hassle.
        </p>

        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          <p className="text-4xl">📁</p>
          {files.length > 0 ? (
            <div className="flex flex-col items-center gap-1">
              <p className="text-blue-600 font-medium">{files.length} file{files.length > 1 ? "s" : ""} selected</p>
              {files.map((f, i) => (
                <p key={i} className="text-gray-400 text-sm">{f.name}</p>
              ))}
            </div>
          ) : (
            <>
              <p className="text-gray-500 font-medium">Click or drag files here to upload</p>
              <p className="text-gray-400 text-sm">Select multiple files at once • Max 100MB per file</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleFileChange}
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={!files.length || uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all"
        >
          {uploading ? "Uploading..." : files.length > 0 ? `Upload ${files.length} file${files.length > 1 ? "s" : ""}` : "Select files first"}
        </button>

        {collectionLink && (
          <div className="w-full bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col gap-3">
            <p className="text-green-700 font-medium">✅ {files.length} file{files.length > 1 ? "s" : ""} uploaded!</p>
            <p className="text-sm text-gray-500 break-all">{collectionLink}</p>
            <button
              onClick={() => navigator.clipboard.writeText(collectionLink)}
              className="text-sm bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-all"
            >
              Copy Share Link
            </button>
          </div>
        )}
      </div>
    </main>
  );
}