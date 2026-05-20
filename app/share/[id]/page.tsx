"use client";
import{useEffect,useState}from"react";
import{supabase}from"../../../lib/supabase";
interface FileRecord{id:string;filename:string;filesize:number;url:string;}
export default function SharePage({params}:{params:{id:string}}){
const[files,setFiles]=useState<FileRecord[]>([]);
const[loading,setLoading]=useState(true);
useEffect(()=>{
supabase.from("files").select("*").eq("collection_id",params.id).then(({data})=>{
if(data)setFiles(data);
setLoading(false);
});
},[params.id]);
return(<main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8"><div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-10 flex flex-col gap-6"><h1 className="text-3xl font-bold text-gray-900">Shared Files</h1><p className="text-gray-500">Someone shared these files with you via DropZone.</p>{loading?(<p className="text-gray-400">Loading...</p>):files.length>0?(<div className="flex flex-col gap-3">{files.map((file)=>(<a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"><span className="text-gray-800 font-medium">{file.filename}</span><span className="text-blue-600 text-sm font-medium">Download</span></a>))}</div>):(<p className="text-gray-400">No files found.</p>)}<div className="border-t pt-4"><p className="text-gray-400 text-sm text-center">Powered by <span className="font-semibold text-blue-600">DropZone</span></p></div></div></main>);
}