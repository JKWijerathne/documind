from app.models import Document
from app.routes import chat
from app.services.graph_service import AnswerGenerationError


def test_chat_saves_and_resumes_conversations(
    db_session,
    authenticated_client,
    test_user,
    monkeypatch,
):
    document = Document(filename="report.pdf", user_id=test_user.id)
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

    first_response = authenticated_client.post(
        "/api/chat/",
        json={
            "query": "What is the conclusion?",
            "document_id": document.id,
        },
    )
    assert first_response.status_code == 200
    first_payload = first_response.json()

    second_response = authenticated_client.post(
        "/api/chat/",
        json={
            "query": "Can you summarize that?",
            "document_id": document.id,
            "conversation_id": first_payload["conversation_id"],
        },
    )
    assert second_response.status_code == 200
    second_payload = second_response.json()

    history_response = authenticated_client.get("/api/chat/conversations")
    detail_response = authenticated_client.get(
        f"/api/chat/conversations/{first_payload['conversation_id']}"
    )

    assert first_payload["conversation_id"] == second_payload["conversation_id"]
    assert graph_calls[0]["user_id"] == test_user.id
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
    authenticated_client,
    test_user,
    monkeypatch,
):
    def fail_generation(**kwargs):
        assert kwargs["conversation_history"] == []
        raise AnswerGenerationError("The AI service is temporarily unavailable.")

    monkeypatch.setattr(chat, "run_rag_graph", fail_generation)

    response = authenticated_client.post(
        "/api/chat/",
        json={"query": "What does the report say?"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "The AI service is temporarily unavailable."
    assert chat.list_conversations(current_user=test_user, db=db_session) == []


def test_unknown_conversation_returns_not_found(authenticated_client):
    detail_response = authenticated_client.get("/api/chat/conversations/999")
    chat_response = authenticated_client.post(
        "/api/chat/",
        json={"query": "Continue", "conversation_id": 999},
    )

    assert detail_response.status_code == 404
    assert chat_response.status_code == 404
