from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    create_csrf_token,
    get_current_user,
    hash_password,
    require_trusted_origin,
    verify_csrf_request,
    verify_password,
)
from app.auth_schemas import LoginRequest, RegisterRequest, UserResponse
from app.config import settings
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _set_auth_cookies(response: Response, user_id: int) -> None:
    max_age = settings.AUTH_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    common_cookie_settings = {
        "max_age": max_age,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "domain": settings.AUTH_COOKIE_DOMAIN,
        "path": settings.AUTH_COOKIE_PATH,
    }
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=create_access_token(user_id),
        httponly=True,
        **common_cookie_settings,
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=create_csrf_token(),
        httponly=False,
        **common_cookie_settings,
    )
    response.headers["Cache-Control"] = "no-store"


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserResponse:
    require_trusted_origin(request)
    response.headers["Cache-Control"] = "no-store"
    email = str(payload.email)
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(email=email, hashed_password=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        if db.query(User).filter(User.email == email).first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            ) from exc
        raise
    return _user_response(user)


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserResponse:
    require_trusted_origin(request)
    email = str(payload.email)
    user = db.query(User).filter(User.email == email).first()
    hashed_password = user.hashed_password if user is not None else DUMMY_PASSWORD_HASH
    password_is_valid = verify_password(payload.password, hashed_password)

    if user is None or not password_is_valid or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    _set_auth_cookies(response, user.id)
    return _user_response(user)


@router.get("/me", response_model=UserResponse)
def get_me(
    response: Response,
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    response.headers["Cache-Control"] = "no-store"
    return _user_response(current_user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response) -> Response:
    verify_csrf_request(request)
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=False,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.headers["Cache-Control"] = "no-store"
    return response
