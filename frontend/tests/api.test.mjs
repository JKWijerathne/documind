import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  ApiError,
  getConversation,
  getCurrentUser,
  listConversations,
  loginAccount,
  logoutAccount,
  registerAccount,
  sendChatMessage,
} from "../lib/api.ts";

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;

beforeEach(() => {
  globalThis.document = { cookie: "documind_csrf=test-csrf-token" };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = originalDocument;
  }
});

test("sends document scope and preserves source metadata", async () => {
  const source = {
    document_id: 7,
    filename: "report.pdf",
    page_number: 3,
    chunk_index: 1,
    relevance: 0.9,
  };
  let requestUrl;
  let requestInit;

  globalThis.fetch = async (url, init) => {
    requestUrl = url;
    requestInit = init;
    return new Response(
      JSON.stringify({
        query: "What is the conclusion?",
        answer: "The conclusion is supported [report.pdf, Page 3].",
        sources: [source],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const response = await sendChatMessage("What is the conclusion?", 4, 7);

  assert.equal(requestUrl, "/backend/api/chat");
  assert.deepEqual(JSON.parse(requestInit.body), {
    query: "What is the conclusion?",
    top_k: 4,
    document_id: 7,
  });
  assert.equal(requestInit.credentials, "include");
  assert.equal(requestInit.headers["X-CSRF-Token"], "test-csrf-token");
  assert.deepEqual(response.sources, [source]);
});

test("formats FastAPI validation details instead of showing object text", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        detail: [
          {
            loc: ["body", "query"],
            msg: "String should have at most 2000 characters",
            type: "string_too_long",
          },
        ],
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );

  await assert.rejects(
    sendChatMessage("x".repeat(2001)),
    /String should have at most 2000 characters/,
  );
});

test("sends a conversation id when continuing an existing conversation", async () => {
  let requestInit;

  globalThis.fetch = async (_url, init) => {
    requestInit = init;
    return new Response(
      JSON.stringify({
        conversation_id: 12,
        query: "When did it happen?",
        answer: "It happened in 2024.",
        sources: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const response = await sendChatMessage(
    "When did it happen?",
    4,
    undefined,
    12,
  );

  assert.equal(JSON.parse(requestInit.body).conversation_id, 12);
  assert.equal(response.conversation_id, 12);
});

test("loads a saved conversation with its messages", async () => {
  const conversation = {
    id: 12,
    title: "What is the conclusion?",
    created_at: "2026-11-13T10:00:00+00:00",
    document_id: null,
    messages: [
      {
        id: 1,
        role: "user",
        content: "What is the conclusion?",
        sources: [],
        created_at: "2026-11-13T10:00:00+00:00",
        document_id: null,
      },
    ],
  };
  let requestUrl;

  globalThis.fetch = async (url) => {
    requestUrl = url;
    return new Response(JSON.stringify(conversation), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const response = await getConversation(12);

  assert.equal(requestUrl, "/backend/api/chat/conversations/12");
  assert.deepEqual(response, conversation);
});

test("lists previous conversations", async () => {
  const conversations = [
    {
      id: 12,
      title: "What is the conclusion?",
      created_at: "2026-11-13T10:00:00+00:00",
      last_message_at: "2026-11-13T10:01:00+00:00",
      preview: "The conclusion is supported.",
    },
  ];
  let requestUrl;

  globalThis.fetch = async (url) => {
    requestUrl = url;
    return new Response(JSON.stringify(conversations), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const response = await listConversations();

  assert.equal(requestUrl, "/backend/api/chat/conversations");
  assert.deepEqual(response, conversations);
});

test("sends credentialed logout with the CSRF cookie in its header", async () => {
  let requestUrl;
  let requestInit;
  globalThis.fetch = async (url, init) => {
    requestUrl = url;
    requestInit = init;
    return new Response(null, { status: 204 });
  };

  await logoutAccount();

  assert.equal(requestUrl, "/backend/api/auth/logout");
  assert.equal(requestInit.method, "POST");
  assert.equal(requestInit.credentials, "include");
  assert.equal(requestInit.headers["X-CSRF-Token"], "test-csrf-token");
});

test("login and registration use credentialed same-origin requests without CSRF", async () => {
  const user = {
    id: 1,
    email: "alice@example.com",
    is_active: true,
    created_at: "2026-11-16T10:00:00Z",
    updated_at: "2026-11-16T10:00:00Z",
  };
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify(user), {
      status: url.endsWith("/register") ? 201 : 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await loginAccount("alice@example.com", "StrongPassword!123");
  await registerAccount("alice@example.com", "StrongPassword!123");

  assert.deepEqual(
    requests.map(({ url }) => url),
    ["/backend/api/auth/login", "/backend/api/auth/register"],
  );
  for (const { init } of requests) {
    assert.equal(init.credentials, "include");
    assert.equal(init.headers["X-CSRF-Token"], undefined);
  }
});

test("preserves HTTP 401 status for current-user checks", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: "Authentication required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(
    getCurrentUser(),
    (error) => error instanceof ApiError && error.status === 401,
  );
});
