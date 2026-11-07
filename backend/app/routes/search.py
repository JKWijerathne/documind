from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.retrieval_service import search_similar_chunks

router = APIRouter(prefix="/api/search", tags=["Search"])


class SearchRequest(BaseModel):
    query: str
    top_k: int = 4


@router.post("/")
def search_documents(payload: SearchRequest, db: Session = Depends(get_db)):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    chunks = search_similar_chunks(db=db, query=payload.query, top_k=payload.top_k)

    return {
        "query": payload.query,
        "top_k": payload.top_k,
        "results": [
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content
            }
            for chunk in chunks
        ]
    }