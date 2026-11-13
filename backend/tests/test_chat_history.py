import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import Document
from app.routes import chat
from app.services.graph_service import AnswerGenerationError


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    session = session_factory()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_chat_saves_and_resumes_conversations(db_session, monkeypatch):
    document = Document(filename="report.pdf")
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    graph_calls = []

    def fake_run_rag_graph(**kwargs):
        graph_calls.append(kwargs)
        return {
            "answer": f"Answer to: {kwargs['query']}",
            "sources": [
                {
                    "document_id": document.id,
                    "filename": document.filename,
                    "page_number": 2,
                    "chunk_index": 0,
                    "relevance": 0.9,
                }
            ],
        }

    monkeypatch.setattr(chat, "run_rag_graph", fake_run_rag_graph)

    app = FastAPI()
    app.include_router(chat.router)
    app.dependency_overrides[get_db] = lambda: db_session

    with TestClient(app) as client:
        first_response = client.post(
            "/api/chat/",
            json={
                "query": "What is the conclusion?",
                "document_id": document.id,
            },
        )
        assert first_response.status_code == 200
        first_payload = first_response.json()

        second_response = client.post(
            "/api/chat/",
            json={
                "query": "Can you summarize that?",
                "document_id": document.id,
                "conversation_id": first_payload["conversation_id"],
            },
        )
        assert second_response.status_code == 200
        second_payload = second_response.json()

        history_response = client.get("/api/chat/conversations")
        detail_response = client.get(
            f"/api/chat/conversations/{first_payload['conversation_id']}"
        )

    assert first_payload["conversation_id"] == second_payload["conversation_id"]
    assert graph_calls[1]["conversation_history"] == [
        {"role": "user", "content": "What is the conclusion?"},
        {"role": "assistant", "content": "Answer to: What is the conclusion?"},
    ]

    detail = detail_response.json()
    assert detail["document_id"] == document.id
    assert [message["role"] for message in detail["messages"]] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    assert detail["messages"][1]["sources"][0]["page_number"] == 2
    assert len(history_response.json()) == 1


def test_failed_generation_does_not_save_an_empty_conversation(
    db_session,
    monkeypatch,
):
    def fail_generation(**kwargs):
        assert kwargs["conversation_history"] == []
        raise AnswerGenerationError("The AI service is temporarily unavailable.")

    monkeypatch.setattr(chat, "run_rag_graph", fail_generation)

    with pytest.raises(HTTPException) as error:
        chat.chat_with_documents(
            chat.ChatRequest(query="What does the report say?"),
            db_session,
        )

    assert error.value.status_code == 503
    assert chat.list_conversations(db_session) == []


def test_unknown_conversation_returns_not_found(db_session):
    with pytest.raises(HTTPException) as error:
        chat.get_conversation(999, db_session)

    assert error.value.status_code == 404

    with pytest.raises(HTTPException) as error:
        chat.chat_with_documents(
            chat.ChatRequest(query="Continue", conversation_id=999),
            db_session,
        )

    assert error.value.status_code == 404
