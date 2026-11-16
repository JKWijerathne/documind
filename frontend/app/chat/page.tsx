"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import ProtectedRoute from "@/components/protected-route";
import {
  getConversation,
  listConversations,
  listDocuments,
  sendChatMessage,
  type ChatSource,
  type ConversationSummary,
  type DocumentRecord,
} from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

interface ConversationView {
  id: number | undefined;
  messages: Message[];
  documentId?: number;
  error?: string;
}

const EMPTY_MESSAGES: Message[] = [];

const suggestedQuestions = [
  "What evidence supports the document's main conclusion?",
  "Which methods does the document describe?",
  "What deadlines or dates are mentioned?",
];

function parseDocumentId(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const documentId = Number(value);
  return Number.isSafeInteger(documentId) ? documentId : undefined;
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-[#080b12] text-sm text-slate-400">
            Loading chat…
          </main>
        }
      >
        <ChatExperience />
      </Suspense>
    </ProtectedRoute>
  );
}

function ChatExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = parseDocumentId(searchParams.get("conversation"));
  const [conversationView, setConversationView] = useState<ConversationView>({
    id: undefined,
    messages: [],
  });
  const activeConversationView =
    conversationView.id === conversationId ? conversationView : null;
  const messages = activeConversationView?.messages ?? EMPTY_MESSAGES;
  const conversationDocumentId = activeConversationView?.documentId;
  const conversationError = activeConversationView?.error ?? null;
  const isLoadingConversation =
    conversationId !== undefined && activeConversationView === null;
  const selectedDocumentId = searchParams.has("document")
    ? parseDocumentId(searchParams.get("document"))
    : conversationDocumentId;
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const messageSequence = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshConversationHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      setConversations(await listConversations());
    } catch (loadError: unknown) {
      setHistoryError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load conversation history.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    listDocuments()
      .then((loadedDocuments) => {
        if (active) setDocuments(loadedDocuments);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setDocumentsError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the document list.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    listConversations()
      .then((loadedConversations) => {
        if (active) setConversations(loadedConversations);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setHistoryError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load conversation history.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoadingHistory(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (conversationId === undefined) return;

    getConversation(conversationId)
      .then((conversation) => {
        if (!active) return;
        setConversationView({
          id: conversationId,
          documentId: conversation.document_id ?? undefined,
          messages: conversation.messages.map((message) => ({
            id: `saved-${message.id}`,
            role: message.role,
            content: message.content,
            sources: message.sources,
          })),
        });
      })
      .catch((loadError: unknown) => {
        if (active) {
          setConversationView({
            id: conversationId,
            messages: [],
            error:
              loadError instanceof Error
                ? loadError.message
                : "Could not load this conversation.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function updateActiveMessages(
    update: (currentMessages: Message[]) => Message[],
  ) {
    setConversationView((currentView) => {
      const currentMessages =
        currentView.id === conversationId ? currentView.messages : [];
      return {
        id: conversationId,
        documentId: selectedDocumentId,
        messages: update(currentMessages),
      };
    });
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userQuery = query.trim();
    if (!userQuery || isLoading || isLoadingConversation) return;

    setQuery("");
    setError(null);
    const userMessageId = `local-${++messageSequence.current}`;
    updateActiveMessages((currentMessages) => [
      ...currentMessages,
      {
        id: userMessageId,
        role: "user",
        content: userQuery,
      },
    ]);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        userQuery,
        4,
        selectedDocumentId,
        conversationId,
      );
      updateActiveMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `local-${++messageSequence.current}`,
          role: "assistant",
          content: response.answer,
          sources: response.sources,
        },
      ]);
      if (conversationId === undefined) {
        const nextSearchParams = new URLSearchParams(searchParams.toString());
        nextSearchParams.set("conversation", response.conversation_id.toString());
        router.replace(`/chat?${nextSearchParams.toString()}`, { scroll: false });
      }
      void refreshConversationHistory();
    } catch (requestError: unknown) {
      updateActiveMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== userMessageId),
      );
      setQuery((currentQuery) => currentQuery || userQuery);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The assistant could not answer right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function startNewConversation() {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("conversation");
    nextSearchParams.set(
      "document",
      selectedDocumentId?.toString() ?? "all",
    );
    router.replace(`/chat?${nextSearchParams.toString()}`, { scroll: false });
    setConversationView({
      id: undefined,
      messages: [],
      documentId: selectedDocumentId,
    });
    setQuery("");
    setError(null);
  }

  function openConversation(id: number) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("conversation", id.toString());
    nextSearchParams.delete("document");
    router.replace(`/chat?${nextSearchParams.toString()}`, { scroll: false });
    setQuery("");
    setError(null);
  }

  function askQuestion(question: string) {
    setQuery(question);
    setError(null);
  }

  function changeDocumentScope(value: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("document", value || "all");

    const queryString = nextSearchParams.toString();
    router.replace(`/chat${queryString ? `?${queryString}` : ""}`, {
      scroll: false,
    });
  }

  const selectedDocumentExists = documents.some(
    (doc) => doc.id === selectedDocumentId && doc.status === "ready",
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-1 flex-col bg-[#080b12] px-5 pb-6 pt-10 text-slate-100 sm:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-300">Document assistant</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Ask your documents
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Answers include source pages. Continue a saved conversation to
              ask follow-up questions.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-10 items-center text-sm text-slate-400 transition hover:text-white"
          >
            Manage documents <span className="ml-2" aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="document-scope" className="text-xs font-medium text-slate-400">
            Search in
          </label>
          <select
            id="document-scope"
            value={selectedDocumentId?.toString() ?? ""}
            onChange={(event) => changeDocumentScope(event.target.value)}
            className="min-h-10 rounded-xl border border-white/10 bg-[#0d121b] px-3 text-sm text-slate-200 outline-none focus:border-indigo-300/50"
          >
            <option value="">All documents</option>
            {selectedDocumentId && !selectedDocumentExists && (
              <option value={selectedDocumentId}>
                Document {selectedDocumentId}
              </option>
            )}
            {documents
              .filter((doc) => doc.status === "ready")
              .map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.filename}
                </option>
              ))}
          </select>
        </div>
        {documentsError && (
          <p role="status" className="mb-4 text-xs text-amber-200/80">
            Could not load document names ({documentsError}); you can still chat
            across all documents.
          </p>
        )}

        <section
          aria-label="Conversation history"
          className="mb-5 rounded-2xl border border-white/[0.08] bg-[#0d121b] p-4 sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Conversation history
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Pick up where you left off or start a new chat.
              </p>
            </div>
            <button
              type="button"
              onClick={startNewConversation}
              disabled={isLoading}
              className="shrink-0 rounded-lg bg-indigo-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-indigo-300"
            >
              New chat
            </button>
          </div>
          {historyError && (
            <div
              role="alert"
              className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-3 py-2"
            >
              <p className="text-xs text-rose-200">{historyError}</p>
              <button
                type="button"
                onClick={() => void refreshConversationHistory()}
                className="text-xs font-medium text-rose-100 underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}
          {isLoadingHistory ? (
            <p role="status" className="py-2 text-xs text-slate-500">
              Loading conversations…
            </p>
          ) : conversations.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  aria-pressed={conversation.id === conversationId}
                  onClick={() => openConversation(conversation.id)}
                  disabled={isLoading}
                  className={`min-w-52 max-w-64 rounded-xl border px-3 py-2 text-left transition ${
                    conversation.id === conversationId
                      ? "border-indigo-300/30 bg-indigo-300/[0.08]"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <span className="block truncate text-xs font-medium text-slate-200">
                    {conversation.title}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-slate-500">
                    {conversation.preview}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-2 text-xs text-slate-500">
              No saved conversations yet.
            </p>
          )}
        </section>

        <section
          aria-label="Conversation"
          className="flex min-h-[420px] flex-1 flex-col rounded-3xl border border-white/[0.08] bg-[#0d121b] p-4 sm:p-6"
        >
          <div className="flex-1 space-y-5 overflow-y-auto pb-5">
            {conversationError && (
              <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-sm text-rose-200">
                {conversationError}{" "}
                <button
                  type="button"
                  onClick={startNewConversation}
                  className="underline underline-offset-2"
                >
                  Start a new chat
                </button>
              </div>
            )}

            {isLoadingConversation && (
              <p role="status" className="py-4 text-center text-sm text-slate-400">
                Loading conversation…
              </p>
            )}

            {messages.length === 0 &&
              !isLoadingConversation &&
              !conversationError && (
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
                  {message.role === "assistant" ? (
                    <div className="space-y-3 text-sm leading-6 [&_a]:text-indigo-200 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-300/30 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-black/20 [&_code]:px-1 [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_ol]:space-y-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/20 [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:space-y-1">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {message.content}
                    </p>
                  )}
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
                            {source.filename} · Page {source.page_number}
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
                disabled={isLoadingConversation}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={2000}
                placeholder="Ask something about your PDFs…"
                rows={1}
                className="max-h-32 min-h-10 flex-1 resize-y bg-transparent py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={!query.trim() || isLoading || isLoadingConversation}
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
  );
}
