from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.rag_service import generate_rag_answer

router = APIRouter(prefix="/api/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    query: str
    top_k: int = 4


@router.post("/")
def chat_with_documents(payload: ChatRequest, db: Session = Depends(get_db)):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    result = generate_rag_answer(db=db, query=payload.query, top_k=payload.top_k)

    return {
        "query": payload.query,
        "answer": result["answer"],
        "sources": result["sources"]
    }