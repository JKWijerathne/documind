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
os.environ["AUTH_SECRET_KEY"] = "test-only-auth-secret-key-that-is-at-least-32-chars"

from app.database import Base, get_db
from app.auth import create_access_token, create_csrf_token
from app.config import settings
from app.models import User
from app.routes import auth, chat, documents, search

TRUSTED_ORIGIN = "http://localhost:3000"


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
    app.include_router(auth.router)
    app.dependency_overrides[get_db] = lambda: db_session

    with TestClient(app) as client:
        yield client


@pytest.fixture
def create_user(db_session):
    def create(email: str) -> User:
        user = User(email=email, hashed_password="test-hash")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return create


@pytest.fixture
def test_user(create_user) -> User:
    return create_user("owner@example.test")


@pytest.fixture
def authenticate_client():
    def authenticate(client: TestClient, user: User) -> TestClient:
        csrf_token = create_csrf_token()
        client.cookies.set(
            settings.AUTH_COOKIE_NAME,
            create_access_token(user.id),
        )
        client.cookies.set(settings.CSRF_COOKIE_NAME, csrf_token)
        client.headers.update(
            {
                "Origin": TRUSTED_ORIGIN,
                "X-CSRF-Token": csrf_token,
            }
        )
        return client

    return authenticate


@pytest.fixture
def authenticated_client(api_client, test_user, authenticate_client):
    return authenticate_client(api_client, test_user)


@pytest.fixture
def make_pdf_bytes() -> Callable[[list[str]], bytes]:
    def create_pdf(page_texts: list[str]) -> bytes:
        with pymupdf.open() as document:
            for text in page_texts:
                page = document.new_page()
                page.insert_text((72, 72), text)
            return document.tobytes()

    return create_pdf
