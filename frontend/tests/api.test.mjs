import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getConversation,
  listConversations,
  sendChatMessage,
} from "../lib/api.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
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
