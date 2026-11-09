from types import SimpleNamespace

from app.services import graph_service


def test_run_rag_graph_retrieves_context_and_returns_page_sources(monkeypatch):
    chunk = SimpleNamespace(
        document_id=7,
        page_number=3,
        chunk_index=1,
        content="The project was founded in 2020."
    )
    retrieval_calls = []
    embedding_calls = []
    generation_calls = []

    def fake_embedding(query):
        embedding_calls.append(query)
        return [0.1, 0.2, 0.3]

    def fake_search(db, query_embedding, top_k, document_id):
        retrieval_calls.append((db, query_embedding, top_k, document_id))
        return [chunk]

    def fake_generate_content(*, model, contents):
        generation_calls.append((model, contents))
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
    db = object()

    result = graph_service.run_rag_graph(
        db=db,
        query="When was the project founded?",
        top_k=2,
        document_id=7
    )

    assert embedding_calls == ["When was the project founded?"]
    assert retrieval_calls == [(db, [0.1, 0.2, 0.3], 2, 7)]
    assert generation_calls[0][1].find("[Page 3]: The project was founded in 2020.") >= 0
    assert result == {
        "answer": "It was founded in 2020. [Page 3]",
        "sources": [
            {"document_id": 7, "page_number": 3, "chunk_index": 1}
        ]
    }
