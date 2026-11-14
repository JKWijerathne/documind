from app.models import Document, DocumentChunk
from app.routes import documents as document_routes
from app.routes import search as search_routes
from app.services.retrieval_service import RetrievedChunk


def test_upload_extracts_chunks_and_saves_mock_embeddings(
    db_session,
    api_client,
    make_pdf_bytes,
    monkeypatch,
):
    embedded_texts = []

    def fake_embeddings(texts):
        embedded_texts.extend(texts)
        return [[0.5] + [0.0] * 383 for _ in texts]

    monkeypatch.setattr(
        document_routes,
        "generate_batch_embeddings",
        fake_embeddings,
    )
    pdf_bytes = make_pdf_bytes(
        ["DocuMind stores searchable text with its PDF page metadata."]
    )

    response = api_client.post(
        "/api/documents/upload",
        files={"file": ("manual.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["total_pages"] == 1
    assert payload["total_chunks"] == 1

    saved_document = (
        db_session.query(Document)
        .filter(Document.id == payload["document_id"])
        .one()
    )
    saved_chunk = (
        db_session.query(DocumentChunk)
        .filter(DocumentChunk.document_id == saved_document.id)
        .one()
    )
    assert saved_document.filename == "manual.pdf"
    assert "searchable text" in saved_chunk.content
    assert saved_chunk.page_number == 1
    assert len(saved_chunk.embedding) == 384
    assert embedded_texts == [saved_chunk.content]


def test_invalid_pdf_upload_returns_400(api_client):
    response = api_client.post(
        "/api/documents/upload",
        files={"file": ("broken.pdf", b"not a PDF", "application/pdf")},
    )

    assert response.status_code == 400
    assert "genuine PDF" in response.json()["detail"]


def test_blank_chat_and_search_queries_return_400(api_client):
    chat_response = api_client.post("/api/chat/", json={"query": "   "})
    search_response = api_client.post("/api/search/", json={"query": "   "})

    assert chat_response.status_code == 400
    assert search_response.status_code == 400
    assert chat_response.json()["detail"] == "Query cannot be empty."
    assert search_response.json()["detail"] == "Query cannot be empty."


def test_search_api_returns_retrieved_page_sources(api_client, monkeypatch):
    chunk = RetrievedChunk(
        id=18,
        document_id=5,
        filename="manual.pdf",
        page_number=4,
        chunk_index=2,
        content="The project launched in 2024.",
        distance=0.15,
    )
    monkeypatch.setattr(
        search_routes,
        "search_similar_chunks",
        lambda **_kwargs: [chunk],
    )

    response = api_client.post(
        "/api/search/",
        json={"query": "When did the project launch?", "top_k": 1},
    )

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["filename"] == "manual.pdf"
    assert result["page_number"] == 4
    assert result["relevance"] == 0.85
