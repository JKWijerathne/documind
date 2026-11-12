const SERVER_API_URL = "/backend";
const BROWSER_API_URL = "/backend";

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
  query: string;
  answer: string;
  sources: ChatSource[];
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
    throw new Error(
      getErrorMessage(payload, `${fallback} (HTTP ${response.status})`),
    );
  }

  return payload as T;
}

export async function checkBackendHealth(): Promise<boolean> {
  const response = await fetch(`${SERVER_API_URL}/health`, { cache: "no-store" });
  const payload = await readResponse<{ status?: string }>(
    response,
    "Backend health check failed.",
  );
  return payload.status === "healthy";
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const response = await fetch(`${SERVER_API_URL}/api/documents`, {
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
    const request = new XMLHttpRequest();
    request.open("POST", `${BROWSER_API_URL}/api/documents/upload`);
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
): Promise<ChatResponse> {
  const response = await fetch(`${BROWSER_API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      top_k: topK,
      document_id: documentId,
    }),
  });

  return readResponse<ChatResponse>(
    response,
    "Failed to get a response from the assistant.",
  );
}
