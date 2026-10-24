from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
import json
import logging
from typing import Optional
from urllib.parse import urlsplit
import os
import bcrypt
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from starlette.responses import JSONResponse
import jwt
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import RUNTIME, SessionLocal, engine
from maintenance import MaintenanceMiddleware
from models import InternshipDB, UserDB


# ---------------- CONFIGURATION ----------------

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing from your .env file")

logger = logging.getLogger('uvicorn.error')


@asynccontextmanager
async def lifespan(_app):
    logger.info('Application startup %s', json.dumps(RUNTIME.status(), sort_keys=True))
    try:
        yield
    finally:
        engine.dispose()
        logger.info('Application shutdown %s', json.dumps(RUNTIME.status(), sort_keys=True))


app = FastAPI(title="Internship Tracker API", lifespan=lifespan)
app.add_middleware(MaintenanceMiddleware, enabled=RUNTIME.maintenance_mode)
CORS_ORIGINS = list(dict.fromkeys([
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "https://internship-tracker-seven-alpha.vercel.app",
    "https://internship-tracker-git-master-kpc13.vercel.app",
    *[
        origin.strip().rstrip("/")
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ],
]))
for origin in CORS_ORIGINS:
    parsed_origin = urlsplit(origin)
    if (
        parsed_origin.scheme not in {"http", "https"}
        or not parsed_origin.hostname
        or parsed_origin.username or parsed_origin.password
        or parsed_origin.path or parsed_origin.query or parsed_origin.fragment
        or "*" in origin or any(character.isspace() for character in origin)
    ):
        raise RuntimeError("CORS_ORIGINS must contain explicit HTTP(S) origins without paths")


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


# ---------------- REQUEST MODELS ----------------

class User(BaseModel):
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


# ---------------- DATABASE SESSION ----------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------- AUTHENTICATION ----------------

def create_token(user_id: int):
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp"]},
        )

        user_id = payload.get("user_id")

        if type(user_id) is not int or user_id <= 0:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if db.query(UserDB.id).filter(UserDB.id == user_id).first() is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user_id

    except InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def commit_internship(db: Session):
    """Rollback failed writes; only translate the ownership constraint violation."""
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        original = error.orig
        if (
            getattr(original, "pgcode", None) == "23503"
            and getattr(getattr(original, "diag", None), "constraint_name", None)
            == "fk_internships_user_id_users"
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None
        raise
    except Exception:
        db.rollback()
        raise


# ---------------- HOME ----------------

@app.get("/")
def home():
    return {"message": "Internship Tracker is running"}


@app.api_route('/status', methods=['GET', 'HEAD'])
async def status(request: Request):
    response = JSONResponse(RUNTIME.status(), headers={'Cache-Control': 'no-store'})
    if request.method == 'HEAD':
        # Retain the GET representation's headers without sending its body.
        response.body = b''
    return response


# ---------------- SIGNUP ----------------

@app.post("/signup")
def signup(user: User, db: Session = Depends(get_db)):
    username = user.username.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Username cannot be blank",
        )

    existing_user = (
        db.query(UserDB)
        .filter(UserDB.username == username)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username already exists",
        )

    hashed_password = bcrypt.hashpw(
        user.password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

    new_user = UserDB(
        username=username,
        password=hashed_password,
    )

    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.query(UserDB).filter(UserDB.username == username).first():
            raise HTTPException(status_code=409, detail="Username already exists")
        raise
    db.refresh(new_user)

    return {
        "message": "User created successfully",
        "username": new_user.username,
    }


# ---------------- LOGIN ----------------

@app.post("/login")
def login(user: User, db: Session = Depends(get_db)):
    username = user.username.strip()

    existing_user = (
        db.query(UserDB)
        .filter(UserDB.username == username)
        .first()
    )

    if not existing_user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
        )

    password_matches = bcrypt.checkpw(
        user.password.encode("utf-8"),
        existing_user.password.encode("utf-8"),
    )

    if not password_matches:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
        )

    token = create_token(existing_user.id)

    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "username": existing_user.username,
    }


# ---------------- VALIDATE INTERNSHIP ----------------

def validate_internship(internship: Internship):
    for field in ("company", "role", "status"):
        value = getattr(internship, field)

        if not value.strip():
            raise HTTPException(
                status_code=422,
                detail=f"{field.replace('_', ' ').title()} cannot be blank",
            )

    allowed_statuses = {
        "Applied",
        "Interview",
        "Rejected",
        "Selected",
        "Assessment",
        "Offer",
        "Withdrawn",
    }

    if internship.status not in allowed_statuses:
        raise HTTPException(
            status_code=422,
            detail="Invalid internship status",
        )


# ---------------- GET INTERNSHIPS ----------------

@app.get("/internships")
def get_internships(
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(InternshipDB)
        .filter(InternshipDB.user_id == current_user)
        .order_by(InternshipDB.id.desc())
        .all()
    )


# ---------------- ADD INTERNSHIP ----------------

@app.post("/internships")
def add_internship(
    internship: Internship,
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_internship(internship)

    new_internship = InternshipDB(
        company=internship.company.strip(),
        role=internship.role.strip(),
        status=internship.status,
        application_date=internship.application_date,
        location=internship.location,
        job_url=internship.job_url,
        notes=internship.notes,
        user_id=current_user,
    )

    db.add(new_internship)
    commit_internship(db)
    db.refresh(new_internship)

    return new_internship


# ---------------- UPDATE INTERNSHIP ----------------

@app.put("/internships/{internship_id}")
def update_internship(
    internship_id: int,
    internship: Internship,
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_internship(internship)

    existing = (
        db.query(InternshipDB)
        .filter(
            InternshipDB.id == internship_id,
            InternshipDB.user_id == current_user,
        )
        .first()
    )

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Internship not found",
        )

    existing.company = internship.company.strip()
    existing.role = internship.role.strip()
    existing.status = internship.status
    existing.application_date = internship.application_date
    existing.location = internship.location
    existing.job_url = internship.job_url
    existing.notes = internship.notes

    commit_internship(db)
    db.refresh(existing)

    return existing


# ---------------- DELETE INTERNSHIP ----------------

@app.delete("/internships/{internship_id}")
def delete_internship(
    internship_id: int,
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(InternshipDB)
        .filter(
            InternshipDB.id == internship_id,
            InternshipDB.user_id == current_user,
        )
        .first()
    )

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Internship not found",
        )

    db.delete(existing)
    commit_internship(db)

    return {"message": "Internship deleted successfully"}


# Wrap the entire application so even unhandled server errors have CORS headers.
app = CORSMiddleware(
    app=app,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
