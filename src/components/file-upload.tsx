"use client";

import { useEffect, useRef, useState } from "react";

const inputClass =
  "block w-full text-sm text-muted-600 file:mr-3 file:rounded-lg file:border-0 file:bg-azure-50 file:px-3 file:py-1.5 file:text-sm file:text-azure-500";

/**
 * File picker for forms. With `direct`, the file goes straight from the browser to cloud storage
 * (signed PUT link from /api/uploads) and the form only submits the resulting key — so large lesson
 * videos never pass through the app server. Without it, the file is posted with the form as usual.
 */
export function FileUpload({ name = "file", direct = false }: { name?: string; direct?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState("");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const clear = () => {
      setKey("");
      setFileName("");
      setProgress(null);
      setError("");
    };
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  if (!direct) return <input ref={ref} type="file" name={name} className={inputClass} />;

  const pick = async (file: File | undefined) => {
    setKey("");
    setError("");
    if (!file) return;
    setFileName(file.name);
    setProgress(0);
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("Storage refused the upload")));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });
      setKey(data.key);
      setProgress(100);
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div className="grid gap-1.5">
      <input ref={ref} type="file" className={inputClass} onChange={(e) => void pick(e.target.files?.[0])} />
      <input type="hidden" name="uploadKey" value={key} />
      <input type="hidden" name="uploadName" value={fileName} />
      {progress !== null && (
        <div className="flex items-center gap-2 text-xs text-muted-600">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-azure-100">
            <div className="h-full rounded-full bg-azure-500 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          {key ? "Uploaded" : `${progress}%`}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
