from datetime import date, datetime, timedelta, timezone
from typing import Optional
import os
from fastapi.middleware.cors import CORSMiddleware
import bcrypt
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import engine, Base, SessionLocal
from models import InternshipDB, UserDB


# ---------------- CONFIGURATION ----------------

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing from your .env file")

app = FastAPI(title="Internship Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://internship-tracker-seven-alpha.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


# ---------------- REQUEST MODELS ----------------

class User(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=72)


class Internship(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    status: str = Field(min_length=1, max_length=50)
    application_date: date

    location: Optional[str] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None


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


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        user_id = payload.get("user_id")

        if not isinstance(user_id, int):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user_id

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------- HOME ----------------

@app.get("/")
def home():
    return {"message": "Internship Tracker is running"}


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
    db.commit()
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
    db.commit()
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

    db.commit()
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
    db.commit()

    return {"message": "Internship deleted successfully"}