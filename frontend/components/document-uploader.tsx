"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { uploadDocument, type DocumentUploadResult } from "@/lib/api";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function DocumentUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentUploadResult | null>(null);

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile || isUploading) return;
    setError(null);
    setResult(null);

    if (!nextFile.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      setError("Choose a PDF file to upload.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("This file is larger than the 10 MB upload limit.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFile(nextFile);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isUploading) return;

    setIsUploading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const uploadResult = await uploadDocument(file, setProgress);
      setProgress(100);
      setResult(uploadResult);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The document could not be uploaded.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-[#111722] p-5 shadow-2xl shadow-black/20 sm:p-8">
      <form onSubmit={handleUpload} className="space-y-6">
        <label
          htmlFor="pdf-file"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (
              !(event.relatedTarget instanceof Node) ||
              !event.currentTarget.contains(event.relatedTarget)
            ) {
              setIsDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            chooseFile(event.dataTransfer.files[0]);
          }}
          className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-10 text-center transition focus-within:ring-2 focus-within:ring-indigo-300 ${
            isDragging
              ? "border-indigo-300 bg-indigo-400/10"
              : "border-slate-700 bg-[#0b1019] hover:border-indigo-400/70 hover:bg-indigo-400/[0.03]"
          }`}
        >
          <span className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-300/10 text-indigo-200">
            <svg viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden="true">
              <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v4A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-lg font-semibold text-white">
            {isDragging ? "Drop your PDF here" : "Drag and drop your PDF"}
          </span>
          <span className="mt-2 text-sm text-slate-400">
            or <span className="text-indigo-300 underline underline-offset-4">browse files</span>
          </span>
          <span className="mt-4 text-xs text-slate-500">
            PDF only · Up to 10 MB
          </span>
          <input
            ref={inputRef}
            id="pdf-file"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={isUploading}
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </label>

        {file && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">{file.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded-lg px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        )}

        {isUploading && (
          <div aria-live="polite" className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>
                {progress < 100 ? "Uploading PDF…" : "Processing and indexing…"}
              </span>
              <span>{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-2 overflow-hidden rounded-full bg-slate-800"
            >
              <div
                className="h-full rounded-full bg-indigo-400 transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        {result && (
          <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-4">
            <p className="font-medium text-emerald-200">Document processed successfully.</p>
            <p className="mt-1 text-sm text-emerald-100/70">
              {result.total_pages} pages · {result.total_chunks} searchable chunks
            </p>
            <Link
              href="/dashboard"
              className="mt-3 inline-flex text-sm font-medium text-emerald-200 underline underline-offset-4 hover:text-white"
            >
              View your documents
            </Link>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Back to documents
          </Link>
          <button
            type="submit"
            disabled={!file || isUploading}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isUploading ? "Working…" : "Upload and process"}
          </button>
        </div>
      </form>
    </section>
  );
}
