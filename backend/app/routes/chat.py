import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation, ConversationMessage, Document
from app.services.graph_service import run_rag_graph, AnswerGenerationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])

MAX_HISTORY_MESSAGES = 12
MAX_CONVERSATION_TITLE_LENGTH = 120


class ChatRequest(BaseModel):
    query: str = Field(..., max_length=2000)
    top_k: int = Field(4, ge=1, le=20)
    document_id: int | None = None
    conversation_id: int | None = Field(default=None, ge=1)


def _serialize_message(message: ConversationMessage) -> dict:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "sources": message.sources or [],
        "created_at": (
            message.created_at.isoformat() if message.created_at is not None else None
        ),
        "document_id": message.document_id,
    }


@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db)):
    latest_messages = (
        db.query(
            ConversationMessage.conversation_id.label("conversation_id"),
            func.max(ConversationMessage.id).label("message_id"),
        )
        .group_by(ConversationMessage.conversation_id)
        .subquery()
    )

    rows = (
        db.query(Conversation, ConversationMessage)
        .outerjoin(
            latest_messages,
            latest_messages.c.conversation_id == Conversation.id,
        )
        .outerjoin(
            ConversationMessage,
            ConversationMessage.id == latest_messages.c.message_id,
        )
        .order_by(
            func.coalesce(
                ConversationMessage.created_at,
                Conversation.created_at,
            ).desc(),
            Conversation.id.desc(),
        )
        .all()
    )

    return [
        {
            "id": conversation.id,
            "title": conversation.title or "New conversation",
            "created_at": (
                conversation.created_at.isoformat()
                if conversation.created_at is not None
                else None
            ),
            "last_message_at": (
                message.created_at.isoformat()
                if message is not None and message.created_at is not None
                else (
                    conversation.created_at.isoformat()
                    if conversation.created_at is not None
                    else None
                )
            ),
            "preview": message.content[:160] if message is not None else "",
        }
        for conversation, message in rows
    ]


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    messages = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.id)
        .all()
    )

    return {
        "id": conversation.id,
        "title": conversation.title or "New conversation",
        "created_at": (
            conversation.created_at.isoformat()
            if conversation.created_at is not None
            else None
        ),
        "document_id": messages[-1].document_id if messages else None,
        "messages": [_serialize_message(message) for message in messages],
    }


@router.post("/")
def chat_with_documents(payload: ChatRequest, db: Session = Depends(get_db)):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    if payload.document_id is not None:
        document = (
            db.query(Document)
            .filter(Document.id == payload.document_id)
            .first()
        )
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found.")

    conversation_id = payload.conversation_id
    conversation_history: list[dict[str, str]] = []
    if conversation_id is not None:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id)
            .first()
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        recent_messages = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.conversation_id == conversation_id)
            .order_by(ConversationMessage.id.desc())
            .limit(MAX_HISTORY_MESSAGES)
            .all()
        )
        conversation_history = [
            {"role": message.role, "content": message.content}
            for message in reversed(recent_messages)
        ]

    # Keep database read transactions closed while waiting on the model.
    db.rollback()

    try:
        result = run_rag_graph(
            db=db,
            query=payload.query,
            top_k=payload.top_k,
            document_id=payload.document_id,
            conversation_history=conversation_history,
        )
    except AnswerGenerationError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    try:
        if conversation_id is None:
            conversation = Conversation(
                title=payload.query.strip()[:MAX_CONVERSATION_TITLE_LENGTH]
            )
            db.add(conversation)
            db.flush()
            conversation_id = conversation.id

        user_message = ConversationMessage(
            conversation_id=conversation_id,
            document_id=payload.document_id,
            role="user",
            content=payload.query,
            sources=[],
        )
        assistant_message = ConversationMessage(
            conversation_id=conversation_id,
            document_id=payload.document_id,
            role="assistant",
            content=result["answer"],
            sources=result["sources"],
        )
        db.add_all([user_message, assistant_message])
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to save chat conversation")
        raise HTTPException(
            status_code=500,
            detail="Failed to save this conversation. Please try again.",
        ) from exc

    return {
        "conversation_id": conversation_id,
        "query": payload.query,
        "answer": result["answer"],
        "sources": result["sources"],
    }