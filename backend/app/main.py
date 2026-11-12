from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine, Base
from app.models import Document, DocumentChunk, Conversation  # noqa: F401 (registers tables)
from app.routes import documents, search, chat
from app.services.embedding_service import get_embedding_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

    Base.metadata.create_all(bind=engine)

    get_embedding_model()

    yield


api = FastAPI(
    title="DocuMind API",
    description="AI-powered document assistant",
    version="1.0.0",
    lifespan=lifespan,
)

api.include_router(documents.router)
api.include_router(search.router)
api.include_router(chat.router)


@api.get("/")
def home():
    return {
        "message": "Welcome to DocuMind API",
        "status": "running"
    }


@api.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@api.get("/health/db")
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "database": "connected"
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed"
        )


app = CORSMiddleware(
    app=api,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)