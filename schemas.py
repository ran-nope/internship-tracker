from datetime import date
from typing import Optional
from urllib.parse import urlsplit
from pydantic import BaseModel, Field, field_validator

class LoginUser(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class Internship(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    status: str = Field(min_length=1, max_length=50)
    application_date: date

    location: Optional[str] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("job_url")
    @classmethod
    def validate_job_url(cls, value: Optional[str]):
        if value is None or not value.strip():
            return None
        value = value.strip()
        try:
            parsed = urlsplit(value)
            valid = parsed.scheme in {"http", "https"} and bool(parsed.hostname)
        except ValueError:
            valid = False
        if not valid or any(character.isspace() for character in value):
            raise ValueError("Job URL must be a valid http:// or https:// URL")
        return value



class SignupUser(LoginUser):
    @field_validator('password')
    @classmethod
    def strong_password(cls, value):
        if len(value) < 8 or not any(c.islower() for c in value) or not any(c.isupper() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError('Use at least 8 characters with lowercase, uppercase and a digit.')
        return value

User = SignupUser
