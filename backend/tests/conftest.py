import os
from collections.abc import Callable

import pymupdf
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["GEMINI_API_KEY"] = "test-api-key"

from app.database import Base, get_db
from app.routes import chat, documents, search


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    session = session_factory()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def api_client(db_session):
    app = FastAPI()
    app.include_router(documents.router)
    app.include_router(search.router)
    app.include_router(chat.router)
    app.dependency_overrides[get_db] = lambda: db_session

    with TestClient(app) as client:
        yield client


@pytest.fixture
def make_pdf_bytes() -> Callable[[list[str]], bytes]:
    def create_pdf(page_texts: list[str]) -> bytes:
        with pymupdf.open() as document:
            for text in page_texts:
                page = document.new_page()
                page.insert_text((72, 72), text)
            return document.tobytes()

    return create_pdf
