from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from google.genai.errors import ServerError
from sqlalchemy.orm import Session

from app.routes import chat
from app.services import graph_service


def test_run_rag_graph_retrieves_context_and_returns_page_sources(monkeypatch):
    chunk = SimpleNamespace(
        document_id=7,
        filename="project.pdf",
        page_number=3,
        chunk_index=1,
        content="The project was founded in 2020.",
        distance=0.1,
    )
    retrieval_calls = []
    embedding_calls = []
    generation_calls = []

    def fake_embedding(query):
        embedding_calls.append(query)
        return [0.1, 0.2, 0.3]

    def fake_search(db, query_embedding, user_id, top_k, document_id):
        retrieval_calls.append((db, query_embedding, user_id, top_k, document_id))
        return [chunk]

    def fake_generate_content(*, model, contents, config):
        generation_calls.append((model, contents, config))
        return SimpleNamespace(text="It was founded in 2020. [Page 3]")

    monkeypatch.setattr(graph_service, "generate_embedding", fake_embedding)
    monkeypatch.setattr(
        graph_service,
        "search_similar_chunks_by_embedding",
        fake_search
    )
    monkeypatch.setattr(
        graph_service,
        "client",
        SimpleNamespace(
            models=SimpleNamespace(generate_content=fake_generate_content)
        )
    )
    monkeypatch.setattr(graph_service, "_rag_graph", None)
    db = Session()

    result = graph_service.run_rag_graph(
        db=db,
        query="When was the project founded?",
        user_id=23,
        top_k=2,
        document_id=7,
        conversation_history=[
            {"role": "user", "content": "Tell me about this project."},
            {"role": "assistant", "content": "It started as a small team."},
        ],
    )

    assert embedding_calls == [
        "Earlier conversation:\n"
        "Tell me about this project.\n"
        "It started as a small team.\n\n"
        "Current question: When was the project founded?"
    ]
    assert retrieval_calls == [(db, [0.1, 0.2, 0.3], 23, 2, 7)]
    assert "[project.pdf, Page 3]: The project was founded in 2020." in generation_calls[0][1]
    assert "You: Tell me about this project." in generation_calls[0][1]
    assert "DocuMind: It started as a small team." in generation_calls[0][1]
    assert generation_calls[0][2].temperature == 0.2
    assert result == {
        "answer": "It was founded in 2020. [Page 3]",
        "sources": [
            {
                "document_id": 7,
                "filename": "project.pdf",
                "page_number": 3,
                "chunk_index": 1,
                "relevance": 0.9,
            }
        ]
    }


def test_gemini_server_error_is_wrapped_with_a_friendly_message(monkeypatch):
    chunk = SimpleNamespace(
        filename="project.pdf",
        page_number=3,
        content="The project was founded in 2020.",
    )

    def fake_generate_content(**kwargs):
        assert kwargs["model"]
        raise ServerError(
            503,
            {
                "error": {
                    "code": 503,
                    "message": "This model is currently experiencing high demand.",
                    "status": "UNAVAILABLE",
                }
            },
        )

    monkeypatch.setattr(
        graph_service,
        "generate_embedding",
        lambda query: [0.1] if query else [],
    )
    monkeypatch.setattr(
        graph_service,
        "search_similar_chunks_by_embedding",
        lambda **kwargs: [chunk] if kwargs else [],
    )
    monkeypatch.setattr(
        graph_service,
        "client",
        SimpleNamespace(
            models=SimpleNamespace(generate_content=fake_generate_content)
        ),
    )
    monkeypatch.setattr(graph_service, "_rag_graph", None)

    with pytest.raises(
        graph_service.AnswerGenerationError,
        match="The AI model is currently experiencing high demand",
    ):
        graph_service.run_rag_graph(
            db=Session(),
            query="When was it founded?",
            user_id=7,
        )


def test_chat_route_returns_503_for_generation_errors(monkeypatch):
    message = (
        "The AI model is currently experiencing high demand. "
        "Please try again shortly."
    )

    def fail_generation(**kwargs):
        assert kwargs
        raise graph_service.AnswerGenerationError(message)

    monkeypatch.setattr(chat, "run_rag_graph", fail_generation)

    with pytest.raises(HTTPException) as error:
        chat.chat_with_documents(
            chat.ChatRequest(query="When was it founded?"),
            current_user=SimpleNamespace(id=1),
            db=SimpleNamespace(rollback=lambda: None),
        )

    assert error.value.status_code == 503
    assert error.value.detail == message
