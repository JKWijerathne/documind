import type { Metadata } from "next";
import ProtectedRoute from "@/components/protected-route";
import DocumentUploader from "@/components/document-uploader";

export const metadata: Metadata = {
  title: "Upload documents | DocuMind",
  description: "Upload a PDF and make it searchable with DocuMind.",
};

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#080b12] text-slate-100">
        <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-8">
          <p className="text-sm font-medium text-indigo-300">Your knowledge base</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Add a document
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Upload a PDF to extract its contents and prepare it for questions
            and search.
          </p>
        </div>
        <DocumentUploader />
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          Documents are sent to your configured DocuMind API for processing.
        </p>
        </main>
      </div>
    </ProtectedRoute>
  );
}
