from app.models import Conversation, ConversationMessage, Document
from app.routes import chat as chat_routes
from app.routes import search as search_routes


def test_document_and_conversation_data_is_isolated_by_owner(
    db_session,
    authenticated_client,
    authenticate_client,
    test_user,
    create_user,
    monkeypatch,
):
    other_user = create_user("other@example.test")
    own_document = Document(filename="own.pdf", user_id=test_user.id)
    other_document = Document(filename="other.pdf", user_id=other_user.id)
    own_conversation = Conversation(title="Own chat", user_id=test_user.id)
    other_conversation = Conversation(title="Other chat", user_id=other_user.id)
    db_session.add_all(
        [own_document, other_document, own_conversation, other_conversation]
    )
    db_session.flush()
    db_session.add_all(
        [
            ConversationMessage(
                conversation_id=own_conversation.id,
                document_id=own_document.id,
                role="user",
                content="Private message",
                sources=[],
            ),
            ConversationMessage(
                conversation_id=other_conversation.id,
                document_id=other_document.id,
                role="user",
                content="Other private message",
                sources=[],
            ),
        ]
    )
    db_session.commit()

    graph_calls = []
    search_calls = []
    monkeypatch.setattr(
        chat_routes,
        "run_rag_graph",
        lambda **kwargs: graph_calls.append(kwargs)
        or {"answer": "A private answer.", "sources": []},
    )
    monkeypatch.setattr(
        search_routes,
        "search_similar_chunks",
        lambda **kwargs: search_calls.append(kwargs) or [],
    )

    documents_response = authenticated_client.get("/api/documents/")
    conversations_response = authenticated_client.get("/api/chat/conversations")
    own_detail = authenticated_client.get(
        f"/api/chat/conversations/{own_conversation.id}"
    )

    assert [item["id"] for item in documents_response.json()] == [own_document.id]
    assert [item["id"] for item in conversations_response.json()] == [
        own_conversation.id
    ]
    assert own_detail.status_code == 200
    assert own_detail.json()["messages"][0]["content"] == "Private message"

    assert authenticated_client.get(
        f"/api/chat/conversations/{other_conversation.id}"
    ).status_code == 404
    assert authenticated_client.delete(
        f"/api/documents/{other_document.id}"
    ).status_code == 404
    assert authenticated_client.post(
        "/api/search/",
        json={"query": "other user's data", "document_id": other_document.id},
    ).status_code == 404
    assert authenticated_client.post(
        "/api/chat/",
        json={"query": "Read the other document.", "document_id": other_document.id},
    ).status_code == 404
    assert authenticated_client.post(
        "/api/chat/",
        json={
            "query": "Continue another user's chat.",
            "conversation_id": other_conversation.id,
        },
    ).status_code == 404
    assert search_calls == []
    assert graph_calls == []
    assert db_session.get(Document, other_document.id) is not None

    created_response = authenticated_client.post(
        "/api/chat/",
        json={
            "query": "Create a private conversation.",
            "user_id": other_user.id,
        },
    )
    assert created_response.status_code == 200
    created_conversation = db_session.get(
        Conversation,
        created_response.json()["conversation_id"],
    )
    assert created_conversation.user_id == test_user.id
    assert graph_calls[0]["user_id"] == test_user.id

    authenticate_client(authenticated_client, other_user)
    other_documents_response = authenticated_client.get("/api/documents/")
    other_conversations_response = authenticated_client.get(
        "/api/chat/conversations"
    )
    assert [item["id"] for item in other_documents_response.json()] == [
        other_document.id
    ]
    assert [item["id"] for item in other_conversations_response.json()] == [
        other_conversation.id
    ]
    assert authenticated_client.get(
        f"/api/chat/conversations/{own_conversation.id}"
    ).status_code == 404


def test_document_and_conversation_reads_require_authentication(api_client):
    assert api_client.get("/api/documents/").status_code == 401
    assert api_client.get("/api/chat/conversations").status_code == 401
    assert api_client.get("/api/chat/conversations/1").status_code == 401
