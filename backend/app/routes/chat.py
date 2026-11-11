from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.graph_service import run_rag_graph, AnswerGenerationError

router = APIRouter(prefix="/api/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    query: str = Field(..., max_length=2000)
    top_k: int = Field(4, ge=1, le=20)
    document_id: int | None = None


@router.post("/")
def chat_with_documents(payload: ChatRequest, db: Session = Depends(get_db)):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    try:
        result = run_rag_graph(
            db=db,
            query=payload.query,
            top_k=payload.top_k,
            document_id=payload.document_id,
        )
    except AnswerGenerationError:
        raise HTTPException(
            status_code=502,
            detail="The AI service is temporarily unavailable. Please try again.",
        )

    return {
        "query": payload.query,
        "answer": result["answer"],
        "sources": result["sources"],
    }