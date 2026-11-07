from sqlalchemy.orm import Session
from app.models import DocumentChunk
from app.services.embedding_service import generate_embedding


def search_similar_chunks(db: Session, query: str, top_k: int = 4) -> list[DocumentChunk]:
   
    query_embedding = generate_embedding(query)

    similar_chunks = (
        db.query(DocumentChunk)
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(top_k)
        .all()
    )

    return similar_chunks