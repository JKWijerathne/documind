import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

JWT_ALGORITHM = "HS256"
CSRF_HEADER_NAME = "X-CSRF-Token"
PASSWORD_HASHER = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = PASSWORD_HASHER.hash(secrets.token_urlsafe(32))

_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return PASSWORD_HASHER.verify(password, hashed_password)
    except UnknownHashError:
        return False


def create_access_token(
    user_id: int,
    expires_delta: timedelta | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.AUTH_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": expires_at,
            "token_type": "access",
        },
        settings.AUTH_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def create_csrf_token() -> str:
    nonce = secrets.token_urlsafe(32)
    signature = hmac.new(
        settings.AUTH_SECRET_KEY.encode("utf-8"),
        b"csrf:" + nonce.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{nonce}.{signature}"


def _is_valid_csrf_token(token: str) -> bool:
    nonce, separator, supplied_signature = token.rpartition(".")
    if not separator or not nonce or not supplied_signature:
        return False

    expected_signature = hmac.new(
        settings.AUTH_SECRET_KEY.encode("utf-8"),
        b"csrf:" + nonce.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(supplied_signature, expected_signature)


def require_trusted_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin is None or origin not in settings.ALLOWED_ORIGINS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request origin is not allowed.",
        )


def verify_csrf_request(request: Request) -> None:
    require_trusted_origin(request)

    cookie_token = request.cookies.get(settings.CSRF_COOKIE_NAME)
    header_token = request.headers.get(CSRF_HEADER_NAME)
    if (
        cookie_token is None
        or header_token is None
        or not hmac.compare_digest(cookie_token, header_token)
        or not _is_valid_csrf_token(cookie_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed.",
        )


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    if request.method in _UNSAFE_METHODS:
        verify_csrf_request(request)

    token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    try:
        claims = jwt.decode(
            token,
            settings.AUTH_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "iat", "sub", "token_type"]},
        )
        subject = claims.get("sub")
        if (
            claims.get("token_type") != "access"
            or not isinstance(subject, str)
            or not subject.isascii()
            or not subject.isdecimal()
            or len(subject) > 10
            or int(subject) < 1
        ):
            raise jwt.InvalidTokenError("Invalid access token claims.")
        user_id = int(subject)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        ) from exc

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )
    return user
