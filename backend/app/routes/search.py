from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.retrieval_service import search_similar_chunks

router = APIRouter(prefix="/api/search", tags=["Search"])


class SearchRequest(BaseModel):
    query: str = Field(..., max_length=2000)
    top_k: int = Field(4, ge=1, le=20)
    document_id: int | None = None


@router.post("/")
def search_documents(payload: SearchRequest, db: Session = Depends(get_db)):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    chunks = search_similar_chunks(
        db=db,
        query=payload.query,
        top_k=payload.top_k,
        document_id=payload.document_id,
    )

    return {
        "query": payload.query,
        "top_k": payload.top_k,
        "results": [
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "filename": chunk.filename,
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "relevance": round(1 - chunk.distance, 3),
            }
            for chunk in chunks
        ],
    }