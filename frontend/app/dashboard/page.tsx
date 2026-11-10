"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/site-header";
import { deleteDocument, listDocuments, type DocumentRecord } from "@/lib/api";

function formatUploadDate(value: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    listDocuments()
      .then((loadedDocuments) => {
        if (active) {
          setDocuments(loadedDocuments);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load documents from the API.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function refreshDocuments() {
    setIsLoading(true);
    setLoadError(null);
    try {
      setDocuments(await listDocuments());
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load documents from the API.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(document: DocumentRecord) {
    const confirmed = window.confirm(
      `Delete "${document.filename}" and all of its indexed content?`,
    );
    if (!confirmed) return;

    setDeletingId(document.id);
    setActionError(null);
    try {
      await deleteDocument(document.id);
      setDocuments((currentDocuments) =>
        currentDocuments.filter((item) => item.id !== document.id),
      );
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : `Could not delete ${document.filename}.`,
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-300">Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Your documents
            </h1>
            <p className="mt-3 text-sm text-slate-400 sm:text-base">
              Browse your files and see which ones are ready to chat with.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/5"
            >
              Open AI chat
            </Link>
            <Link
              href="/upload"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300"
            >
              <span className="mr-2 text-lg leading-none" aria-hidden="true">+</span>
              Upload PDF
            </Link>
          </div>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-300">
              {documents.length} {documents.length === 1 ? "document" : "documents"}
            </p>
            <button
              type="button"
              onClick={refreshDocuments}
              disabled={isLoading}
              className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              {isLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {loadError && (
            <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-rose-200">{loadError}</p>
              <button
                type="button"
                onClick={refreshDocuments}
                className="shrink-0 rounded-lg border border-rose-200/20 px-3 py-2 text-xs font-medium text-rose-100 hover:bg-rose-200/10"
              >
                Try again
              </button>
            </div>
          )}

          {actionError && (
            <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">
              {actionError}
            </p>
          )}

          {isLoading && documents.length === 0 && !loadError && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d121b] p-8 text-center text-sm text-slate-400">
              Loading your documents…
            </div>
          )}

          {!isLoading && !loadError && documents.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-[#0d121b] px-6 py-16 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-300/10 text-indigo-200">
                <svg viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden="true">
                  <path d="M7 3.75h6.5L19 9.25v11H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M13 4v5.5h5.5M9 14h6m-6 3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <h2 className="mt-5 text-lg font-semibold text-white">Your library is ready for its first PDF</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Upload a document to make it searchable and start asking questions.
              </p>
              <Link
                href="/upload"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300"
              >
                Upload a document
              </Link>
            </div>
          )}

          {documents.length > 0 && (
            <ul className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d121b]">
              {documents.map((document, index) => (
                <li
                  key={document.id}
                  className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
                    index > 0 ? "border-t border-white/[0.07]" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-rose-300/10 bg-rose-300/[0.07] text-xs font-bold text-rose-200">
                      PDF
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {document.filename}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Added {formatUploadDate(document.upload_date)} · {document.total_chunks}{" "}
                        {document.total_chunks === 1 ? "chunk" : "chunks"} · ID {document.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                        document.status === "ready"
                          ? "border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200"
                          : "border-rose-300/15 bg-rose-300/[0.07] text-rose-200"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          document.status === "ready"
                            ? "bg-emerald-300"
                            : "bg-rose-300"
                        }`}
                      />
                      {document.status === "ready" ? "Ready" : "No indexed content"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(document)}
                      disabled={deletingId === document.id}
                      className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-wait disabled:opacity-50"
                      aria-label={`Delete ${document.filename}`}
                    >
                      {deletingId === document.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
