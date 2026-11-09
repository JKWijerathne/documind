from sqlalchemy.orm import Session
from app.models import DocumentChunk
from app.services.embedding_service import generate_embedding


def search_similar_chunks_by_embedding(
    db: Session,
    query_embedding: list[float],
    top_k: int = 4,
    document_id: int | None = None
) -> list[DocumentChunk]:
    query = db.query(DocumentChunk)
    if document_id is not None:
        query = query.filter(DocumentChunk.document_id == document_id)

    return (
        query
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(top_k)
        .all()
    )


def search_similar_chunks(
    db: Session,
    query: str,
    top_k: int = 4
) -> list[DocumentChunk]:
    query_embedding = generate_embedding(query)
    return search_similar_chunks_by_embedding(
        db=db,
        query_embedding=query_embedding,
        top_k=top_k
    )