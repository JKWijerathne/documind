import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { sendChatMessage } from "../lib/api.ts";

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
