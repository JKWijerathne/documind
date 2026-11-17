from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Document, DocumentChunk
from app.services.embedding_service import generate_embedding


@dataclass
class RetrievedChunk:
    id: int
    document_id: int
    filename: str
    page_number: int
    chunk_index: int
    content: str
    distance: float 

def search_similar_chunks_by_embedding(
    db: Session,
    query_embedding: list[float],
    user_id: int,
    top_k: int = 4,
    document_id: int | None = None,
    max_distance: float | None = None,
) -> list[RetrievedChunk]:
    if max_distance is None:
        max_distance = settings.MAX_COSINE_DISTANCE

    distance = DocumentChunk.embedding.cosine_distance(query_embedding)

    query = (
        db.query(DocumentChunk, Document.filename, distance.label("distance"))
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(Document.user_id == user_id)
    )

    if document_id is not None:
        query = query.filter(DocumentChunk.document_id == document_id)

    query = query.filter(distance <= max_distance)

    rows = query.order_by(distance).limit(top_k).all()

    return [
        RetrievedChunk(
            id=chunk.id,
            document_id=chunk.document_id,
            filename=filename,
            page_number=chunk.page_number,
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            distance=float(dist),
        )
        for chunk, filename, dist in rows
    ]


def search_similar_chunks(
    db: Session,
    query: str,
    user_id: int,
    top_k: int = 4,
    document_id: int | None = None,
    max_distance: float | None = None,
) -> list[RetrievedChunk]:
    query_embedding = generate_embedding(query)
    return search_similar_chunks_by_embedding(
        db=db,
        query_embedding=query_embedding,
        user_id=user_id,
        top_k=top_k,
        document_id=document_id,
        max_distance=max_distance,
    )