from types import SimpleNamespace
from unittest.mock import Mock

from app.services.retrieval_service import search_similar_chunks_by_embedding


def test_retrieval_returns_closest_matching_chunks_with_metadata():
    closest_chunk = SimpleNamespace(
        id=11,
        document_id=4,
        page_number=2,
        chunk_index=1,
        content="The project launched in 2024.",
    )
    next_chunk = SimpleNamespace(
        id=12,
        document_id=4,
        page_number=3,
        chunk_index=2,
        content="The first release followed testing.",
    )
    query = Mock()
    query.join.return_value = query
    query.filter.return_value = query
    query.order_by.return_value = query
    query.limit.return_value = query
    query.all.return_value = [
        (closest_chunk, "manual.pdf", 0.1),
        (next_chunk, "manual.pdf", 0.25),
    ]
    db = Mock()
    db.query.return_value = query

    results = search_similar_chunks_by_embedding(
        db=db,
        query_embedding=[0.1] * 384,
        user_id=73,
        top_k=2,
        document_id=4,
        max_distance=0.65,
    )

    assert [chunk.id for chunk in results] == [11, 12]
    assert results[0].filename == "manual.pdf"
    assert results[0].page_number == 2
    assert results[0].content == "The project launched in 2024."
    assert [chunk.distance for chunk in results] == [0.1, 0.25]
    assert query.filter.call_count == 3
    ownership_filter = query.filter.call_args_list[0].args[0]
    assert str(ownership_filter) == "documents.user_id = :user_id_1"
    assert ownership_filter.right.value == 73
    query.limit.assert_called_once_with(2)
