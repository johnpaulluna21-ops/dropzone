"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [shareLink, setShareLink] = useState("");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFiles(Array.from(e.dataTransfer.files));
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);

    const collectionId = crypto.randomUUID();

    for (const file of files) {
      const { data, error } = await supabase.storage
        .from("files")
        .upload(`${collectionId}/${file.name}`, file);

      if (error) { console.error(error); continue; }

      const { data: urlData } = supabase.storage
        .from("files")
        .getPublicUrl(`${collectionId}/${file.name}`);

      await supabase.from("files").insert({
        collection_id: collectionId,
        filename: file.name,
        filesize: file.size,
        url: urlData.publicUrl,
      });
    }

    setShareLink(`${window.location.origin}/share/${collectionId}`);
    setUploading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-10 flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-gray-900">DropZone</h1>
        <p className="text-gray-500">Drop your files and share them instantly.</p>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 hover:border-blue-400 transition-all cursor-pointer"
        >
          {files.length > 0
            ? files.map((f) => <p key={f.name}>{f.name}</p>)
            : "Drag & drop files here"}
        </div>

        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="text-sm text-gray-500"
        />

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload & Get Link"}
        </button>

        {shareLink && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-1">Your share link:</p>
            <a href={shareLink} className="text-blue-600 font-medium break-all">{shareLink}</a>
          </div>
        )}

        <div className="border-t pt-4">
          <p className="text-gray-400 text-sm text-center">
            Powered by <span className="font-semibold text-blue-600">DropZone</span>
          </p>
        </div>
      </div>
    </main>
  );
}