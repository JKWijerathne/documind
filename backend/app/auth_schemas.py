from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class EmailRequest(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class RegisterRequest(EmailRequest):
    password: str = Field(min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        requirements = (
            any(character.islower() for character in value),
            any(character.isupper() for character in value),
            any(character.isdigit() for character in value),
            any(
                character.isprintable()
                and not character.isalnum()
                and not character.isspace()
                for character in value
            ),
        )
        if not all(requirements):
            raise ValueError(
                "Password must include lowercase and uppercase letters, a number, "
                "and a symbol."
            )
        return value


class LoginRequest(EmailRequest):
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    created_at: datetime
    updated_at: datetime
