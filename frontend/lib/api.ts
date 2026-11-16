const SERVER_API_URL = "/backend";
const BROWSER_API_URL = "/backend";
const CSRF_COOKIE_NAME = "documind_csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";

export interface AuthUser {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export interface ChatSource {
  document_id: number;
  filename: string;
  page_number: number;
  chunk_index: number;
  relevance: number;
}

export interface DocumentRecord {
  id: number;
  filename: string;
  upload_date: string | null;
  total_chunks: number;
  status: "ready" | "failed";
}

export interface DocumentUploadResult {
  document_id: number;
  filename: string;
  total_pages: number;
  total_chunks: number;
  status: "ready";
  message: string;
}

export interface ChatResponse {
  conversation_id: number;
  query: string;
  answer: string;
  sources: ChatSource[];
}

export interface ConversationSummary {
  id: number;
  title: string;
  created_at: string | null;
  last_message_at: string | null;
  preview: string;
}

export interface ConversationMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[];
  created_at: string | null;
  document_id: number | null;
}

export interface ConversationDetail {
  id: number;
  title: string;
  created_at: string | null;
  document_id: number | null;
  messages: ConversationMessage[];
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) {
    if (payload.trim() === "Internal Server Error") {
      return fallback;
    }
    return payload.trim();
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "detail" in payload
  ) {
    if (typeof payload.detail === "string") {
      return payload.detail;
    }

    if (Array.isArray(payload.detail)) {
      const messages = payload.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (
            typeof item === "object" &&
            item !== null &&
            "msg" in item &&
            typeof item.msg === "string"
          ) {
            return item.msg;
          }
          return null;
        })
        .filter((message): message is string => message !== null);

      if (messages.length > 0) return messages.join("; ");
    }
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallback;
}

async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  let payload: unknown;
  const responseText = await response.text();

  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = responseText;
  }

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload, `${fallback} (HTTP ${response.status})`),
      response.status,
    );
  }

  return payload as T;
}

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  const cookiePrefix = `${CSRF_COOKIE_NAME}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookiePrefix));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(cookiePrefix.length));
  } catch {
    return null;
  }
}

function csrfHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const token = getCsrfToken();
  if (!token) {
    throw new Error("Your security token is missing. Refresh the page and try again.");
  }
  return { ...headers, [CSRF_HEADER_NAME]: token };
}

function isAuthUser(payload: unknown): payload is AuthUser {
  if (typeof payload !== "object" || payload === null) return false;
  if (
    !("id" in payload) ||
    !("email" in payload) ||
    !("is_active" in payload) ||
    !("created_at" in payload) ||
    !("updated_at" in payload)
  ) {
    return false;
  }

  return (
    typeof payload.id === "number" &&
    Number.isInteger(payload.id) &&
    typeof payload.email === "string" &&
    typeof payload.is_active === "boolean" &&
    typeof payload.created_at === "string" &&
    typeof payload.updated_at === "string"
  );
}

async function readAuthUser(response: Response, fallback: string): Promise<AuthUser> {
  const payload = await readResponse<unknown>(response, fallback);
  if (!isAuthUser(payload)) {
    throw new ApiError("The server returned an unexpected account response.", response.status);
  }
  return payload;
}

export function getUserFacingAuthError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) {
    return "Unable to connect to DocuMind. Check your connection and try again.";
  }
  if (error instanceof ApiError && error.status >= 500) {
    return "DocuMind is temporarily unavailable. Please try again.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function registerAccount(
  email: string,
  password: string,
): Promise<AuthUser> {
  const response = await fetch(`${BROWSER_API_URL}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return readAuthUser(response, "Could not create your account.");
}

export async function loginAccount(
  email: string,
  password: string,
): Promise<AuthUser> {
  const response = await fetch(`${BROWSER_API_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return readAuthUser(response, "Could not sign in.");
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await fetch(`${SERVER_API_URL}/api/auth/me`, {
    credentials: "include",
    cache: "no-store",
  });
  return readAuthUser(response, "Could not check your sign-in status.");
}

export async function logoutAccount(): Promise<void> {
  const response = await fetch(`${BROWSER_API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: csrfHeaders(),
  });
  if (!response.ok) {
    await readResponse<unknown>(response, "Could not log out.");
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  const response = await fetch(`${SERVER_API_URL}/health`, {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await readResponse<{ status?: string }>(
    response,
    "Backend health check failed.",
  );
  return payload.status === "healthy";
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const response = await fetch(`${SERVER_API_URL}/api/documents`, {
    credentials: "include",
    cache: "no-store",
  });
  return readResponse<DocumentRecord[]>(
    response,
    "Failed to load your documents.",
  );
}

export function uploadDocument(
  file: File,
  onProgress: (progress: number) => void,
): Promise<DocumentUploadResult> {
  return new Promise((resolve, reject) => {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      reject(new Error("Your security token is missing. Refresh the page and try again."));
      return;
    }

    const request = new XMLHttpRequest();
    request.open("POST", `${BROWSER_API_URL}/api/documents/upload`);
    request.withCredentials = true;
    request.setRequestHeader(CSRF_HEADER_NAME, csrfToken);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("error", () => {
      reject(new Error("Could not connect to the DocuMind API."));
    });

    request.addEventListener("load", () => {
      let payload: unknown;

      try {
        payload = JSON.parse(request.responseText);
      } catch {
        payload = request.responseText;
      }

      if (request.status < 200 || request.status >= 300) {
        reject(
          new Error(
            getErrorMessage(
              payload,
              `Failed to upload document (HTTP ${request.status}). Check the FastAPI server logs.`,
            ),
          ),
        );
        return;
      }

      resolve(payload as DocumentUploadResult);
    });

    const formData = new FormData();
    formData.append("file", file);
    request.send(formData);
  });
}

export async function deleteDocument(documentId: number): Promise<void> {
  const response = await fetch(`${BROWSER_API_URL}/api/documents/${documentId}`, {
    method: "DELETE",
    credentials: "include",
    headers: csrfHeaders(),
  });
  await readResponse<{ message: string }>(
    response,
    "Failed to delete document.",
  );
}

export async function sendChatMessage(
  query: string,
  topK = 4,
  documentId?: number,
  conversationId?: number,
): Promise<ChatResponse> {
  const response = await fetch(`${BROWSER_API_URL}/api/chat`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...csrfHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      top_k: topK,
      document_id: documentId,
      conversation_id: conversationId,
    }),
  });

  return readResponse<ChatResponse>(
    response,
    "Failed to get a response from the assistant.",
  );
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await fetch(`${BROWSER_API_URL}/api/chat/conversations`, {
    credentials: "include",
    cache: "no-store",
  });
  return readResponse<ConversationSummary[]>(
    response,
    "Failed to load your conversation history.",
  );
}

export async function getConversation(
  conversationId: number,
): Promise<ConversationDetail> {
  const response = await fetch(
    `${BROWSER_API_URL}/api/chat/conversations/${conversationId}`,
    { credentials: "include", cache: "no-store" },
  );
  return readResponse<ConversationDetail>(
    response,
    "Failed to load this conversation.",
  );
}
