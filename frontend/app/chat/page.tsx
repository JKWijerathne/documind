"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import SiteHeader from "@/components/site-header";
import { sendChatMessage } from "@/lib/api";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    document_id: number;
    page_number: number;
    chunk_index: number;
  }>;
}

const suggestedQuestions = [
  "Summarize my documents",
  "What are the key takeaways?",
  "Find important dates",
];

export default function ChatPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageSequence = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userQuery = query.trim();
    if (!userQuery || isLoading) return;

    setQuery("");
    setError(null);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: ++messageSequence.current,
        role: "user",
        content: userQuery,
      },
    ]);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(userQuery);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: ++messageSequence.current,
          role: "assistant",
          content: response.answer,
          sources: response.sources,
        },
      ]);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The assistant could not answer right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function askQuestion(question: string) {
    setQuery(question);
    setError(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#080b12] text-slate-100">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pb-6 pt-10 sm:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-300">Document assistant</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Ask your documents
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Answers are generated from your indexed PDFs and include source pages.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-10 items-center text-sm text-slate-400 transition hover:text-white"
          >
            Manage documents <span className="ml-2" aria-hidden="true">→</span>
          </Link>
        </div>

        <section
          aria-label="Conversation"
          className="flex min-h-[420px] flex-1 flex-col rounded-3xl border border-white/[0.08] bg-[#0d121b] p-4 sm:p-6"
        >
          <div className="flex-1 space-y-5 overflow-y-auto pb-5">
            {messages.length === 0 && (
              <div className="flex min-h-[350px] flex-col items-center justify-center px-4 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl border border-indigo-300/15 bg-indigo-300/[0.08] text-lg font-bold text-indigo-200">
                  D
                </span>
                <h2 className="mt-5 text-lg font-semibold text-white">
                  What would you like to know?
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Ask a question about your uploaded documents. DocuMind will
                  find relevant passages and show you where they came from.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => askQuestion(question)}
                      className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-slate-300 transition hover:border-indigo-300/30 hover:text-white"
                    >
                      {question}
                    </button>
                  ))}
                </div>
                <Link
                  href="/upload"
                  className="mt-5 text-xs text-indigo-300 underline underline-offset-4 hover:text-indigo-200"
                >
                  Add a PDF to get started
                </Link>
              </div>
            )}

            {messages.map((message) => (
              <article
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-indigo-300/15 bg-indigo-300/[0.08] text-xs font-bold text-indigo-200">
                    D
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "rounded-br-md bg-indigo-400 text-slate-950"
                      : "rounded-tl-md border border-white/[0.07] bg-white/[0.035] text-slate-200"
                  }`}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                    {message.role === "user" ? "You" : "DocuMind"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 border-t border-white/[0.08] pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Sources
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {message.sources.map((source, index) => (
                          <span
                            key={`${message.id}-${source.document_id}-${source.page_number}-${index}`}
                            className="rounded-lg border border-indigo-300/10 bg-indigo-300/[0.06] px-2.5 py-1.5 text-xs text-indigo-100/80"
                          >
                            Document {source.document_id} · Page {source.page_number}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}

            {isLoading && (
              <div role="status" aria-live="polite" className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg border border-indigo-300/15 bg-indigo-300/[0.08] text-xs font-bold text-indigo-200">
                  D
                </span>
                <p className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-sm text-slate-400">
                  Searching your documents…
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          )}

          <form onSubmit={handleSend} className="border-t border-white/[0.08] pt-4">
            <label htmlFor="chat-question" className="sr-only">
              Ask a question about your documents
            </label>
            <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-[#080b12] p-2 pl-4 transition focus-within:border-indigo-300/40">
              <textarea
                id="chat-question"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask something about your PDFs…"
                rows={1}
                className="max-h-32 min-h-10 flex-1 resize-y bg-transparent py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-400 text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                aria-label="Send message"
              >
                {isLoading ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                    <path d="m5 12 14-7-4.5 14-2.7-5.8L5 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-slate-600">
              Enter to send · Shift + Enter for a new line
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
