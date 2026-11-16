from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth import create_access_token, get_current_user, hash_password
from app.config import settings
from app.database import get_db
from app.models import User

TRUSTED_ORIGIN = "http://localhost:3000"
STRONG_PASSWORD = "StrongPassword!123"


def _register(api_client, email="  Alice@Example.com  ", password=STRONG_PASSWORD):
    return api_client.post(
        "/api/auth/register",
        headers={"Origin": TRUSTED_ORIGIN},
        json={"email": email, "password": password},
    )


def test_registration_normalizes_email_and_stores_argon2id(
    db_session,
    api_client,
):
    response = _register(api_client)

    assert response.status_code == 201
    payload = response.json()
    assert payload["email"] == "alice@example.com"
    assert "hashed_password" not in payload

    user = db_session.query(User).filter(User.email == "alice@example.com").one()
    assert user.hashed_password.startswith("$argon2id$")
    assert user.is_active is True
    assert user.created_at is not None
    assert user.updated_at is not None


def test_registration_rejects_duplicate_normalized_email(api_client):
    assert _register(api_client).status_code == 201

    response = _register(api_client, "ALICE@example.com")

    assert response.status_code == 409
    assert response.json()["detail"] == "An account with this email already exists."


def test_registration_requires_strong_password(api_client):
    response = _register(api_client, password="weakpassword")

    assert response.status_code == 422


def test_login_sets_http_only_auth_cookie_and_me_returns_user(api_client):
    assert _register(api_client).status_code == 201

    response = api_client.post(
        "/api/auth/login",
        headers={"Origin": TRUSTED_ORIGIN},
        json={"email": " ALICE@example.com ", "password": STRONG_PASSWORD},
    )

    assert response.status_code == 200
    assert "access_token" not in response.json()
    assert "hashed_password" not in response.json()
    auth_cookie = response.cookies.get(settings.AUTH_COOKIE_NAME)
    csrf_cookie = response.cookies.get(settings.CSRF_COOKIE_NAME)
    assert auth_cookie is not None
    assert csrf_cookie is not None
    assert "$argon2" not in auth_cookie
    assert "httponly" in response.headers["set-cookie"].lower()
    assert "samesite=lax" in response.headers["set-cookie"].lower()
    assert response.headers["cache-control"] == "no-store"

    me_response = api_client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "alice@example.com"
    assert "hashed_password" not in me_response.json()


def test_login_uses_same_error_for_unknown_email_and_wrong_password(api_client):
    assert _register(api_client).status_code == 201
    wrong_password = api_client.post(
        "/api/auth/login",
        headers={"Origin": TRUSTED_ORIGIN},
        json={"email": "alice@example.com", "password": "WrongPassword!123"},
    )
    unknown_email = api_client.post(
        "/api/auth/login",
        headers={"Origin": TRUSTED_ORIGIN},
        json={"email": "bob@example.com", "password": "WrongPassword!123"},
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_auth_endpoints_reject_untrusted_origins(api_client):
    response = api_client.post(
        "/api/auth/login",
        headers={"Origin": "https://attacker.example"},
        json={"email": "alice@example.com", "password": STRONG_PASSWORD},
    )

    assert response.status_code == 403


def test_me_rejects_missing_invalid_and_expired_tokens(db_session, api_client):
    assert api_client.get("/api/auth/me").status_code == 401

    api_client.cookies.set(settings.AUTH_COOKIE_NAME, "not-a-jwt")
    assert api_client.get("/api/auth/me").status_code == 401

    user = User(email="alice@example.com", hashed_password=hash_password(STRONG_PASSWORD))
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    api_client.cookies.set(
        settings.AUTH_COOKIE_NAME,
        create_access_token(user.id, timedelta(seconds=-1)),
    )
    assert api_client.get("/api/auth/me").status_code == 401

    now = datetime.now(timezone.utc)
    api_client.cookies.set(
        settings.AUTH_COOKIE_NAME,
        jwt.encode(
            {
                "sub": str(user.id),
                "iat": now,
                "exp": now + timedelta(minutes=5),
                "token_type": "access",
            },
            "a-different-test-secret-that-is-long-enough",
            algorithm="HS256",
        ),
    )
    assert api_client.get("/api/auth/me").status_code == 401

    api_client.cookies.set(
        settings.AUTH_COOKIE_NAME,
        jwt.encode(
            {
                "sub": "99999999999",
                "iat": now,
                "exp": now + timedelta(minutes=5),
                "token_type": "access",
            },
            settings.AUTH_SECRET_KEY,
            algorithm="HS256",
        ),
    )
    assert api_client.get("/api/auth/me").status_code == 401


def test_me_rejects_inactive_users(db_session, api_client):
    user = User(
        email="inactive@example.com",
        hashed_password=hash_password(STRONG_PASSWORD),
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    api_client.cookies.set(
        settings.AUTH_COOKIE_NAME,
        create_access_token(user.id),
    )

    response = api_client.get("/api/auth/me")

    assert response.status_code == 401


def test_login_rejects_inactive_users_with_generic_credentials_error(
    db_session,
    api_client,
):
    user = User(
        email="inactive@example.com",
        hashed_password=hash_password(STRONG_PASSWORD),
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()

    response = api_client.post(
        "/api/auth/login",
        headers={"Origin": TRUSTED_ORIGIN},
        json={"email": "inactive@example.com", "password": STRONG_PASSWORD},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_authenticated_unsafe_requests_require_valid_csrf_token(
    db_session,
    api_client,
):
    user = User(email="alice@example.com", hashed_password=hash_password(STRONG_PASSWORD))
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    protected_app = FastAPI()

    def protected_endpoint(current_user: User = Depends(get_current_user)):
        return {"user_id": current_user.id}

    protected_app.add_api_route(
        "/protected",
        protected_endpoint,
        methods=["POST"],
    )
    protected_app.dependency_overrides[get_db] = lambda: db_session

    protected_client = TestClient(protected_app)
    protected_client.cookies.set(
        settings.AUTH_COOKIE_NAME,
        create_access_token(user.id),
    )

    missing_token_response = protected_client.post(
        "/protected",
        headers={"Origin": TRUSTED_ORIGIN},
    )
    assert missing_token_response.status_code == 403

    forged_token = "attacker-controlled-token"
    protected_client.cookies.set(settings.CSRF_COOKIE_NAME, forged_token)
    forged_token_response = protected_client.post(
        "/protected",
        headers={
            "Origin": TRUSTED_ORIGIN,
            "X-CSRF-Token": forged_token,
        },
    )
    assert forged_token_response.status_code == 403

    csrf_token = api_client.post(
        "/api/auth/login",
        headers={"Origin": TRUSTED_ORIGIN},
        json={"email": "alice@example.com", "password": STRONG_PASSWORD},
    ).cookies[settings.CSRF_COOKIE_NAME]
    protected_client.cookies.set(settings.CSRF_COOKIE_NAME, csrf_token)
    success_response = protected_client.post(
        "/protected",
        headers={
            "Origin": TRUSTED_ORIGIN,
            "X-CSRF-Token": csrf_token,
        },
    )

    assert success_response.status_code == 200
    assert success_response.json() == {"user_id": user.id}


def test_logout_clears_cookies_after_csrf_validation(api_client):
    assert _register(api_client).status_code == 201
    assert api_client.post(
        "/api/auth/login",
        headers={"Origin": TRUSTED_ORIGIN},
        json={"email": "alice@example.com", "password": STRONG_PASSWORD},
    ).status_code == 200

    csrf_token = api_client.cookies.get(settings.CSRF_COOKIE_NAME)
    response = api_client.post(
        "/api/auth/logout",
        headers={
            "Origin": TRUSTED_ORIGIN,
            "X-CSRF-Token": csrf_token,
        },
    )

    assert response.status_code == 204
    assert response.text == ""
    assert settings.AUTH_COOKIE_NAME not in api_client.cookies
    assert settings.CSRF_COOKIE_NAME not in api_client.cookies


def test_logout_rejects_missing_or_forged_csrf_token(api_client):
    response = api_client.post(
        "/api/auth/logout",
        headers={"Origin": TRUSTED_ORIGIN, "X-CSRF-Token": "forged"},
    )

    assert response.status_code == 403
