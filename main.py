from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt
from datetime import datetime, timedelta
import bcrypt

from database import engine, Base, SessionLocal
from models import InternshipDB, UserDB


app = FastAPI()


# ---------------- CORS ----------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- DATABASE ----------------

Base.metadata.create_all(bind=engine)


# ---------------- JWT SETTINGS ----------------

SECRET_KEY = "internship-tracker-secret-key-change-later"
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


# ---------------- MODELS ----------------

class Internship(BaseModel):
    company: str
    role: str
    status: str
    application_date: str


class User(BaseModel):
    username: str
    password: str


# ---------------- DATABASE SESSION ----------------

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ---------------- JWT FUNCTION ----------------

def create_token(user_id: int):

    data = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }

    return jwt.encode(
        data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def get_current_user(
    token: str = Depends(oauth2_scheme)
):

    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM]
    )

    return payload["user_id"]


# ---------------- HOME ----------------

@app.get("/")
def home():

    return {
        "message": "Internship Tracker is running"
    }


# ---------------- SIGNUP ----------------

@app.post("/signup")
def signup(
    user: User,
    db: Session = Depends(get_db)
):

    existing_user = db.query(UserDB).filter(
        UserDB.username == user.username
    ).first()

    if existing_user:

        return {
            "error": "Username already exists"
        }


    hashed_password = bcrypt.hashpw(
        user.password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")


    new_user = UserDB(
        username=user.username,
        password=hashed_password
    )


    db.add(new_user)

    db.commit()

    db.refresh(new_user)


    return {
        "message": "User created successfully",
        "username": new_user.username
    }


# ---------------- LOGIN ----------------

@app.post("/login")
def login(
    user: User,
    db: Session = Depends(get_db)
):

    existing_user = db.query(UserDB).filter(
        UserDB.username == user.username
    ).first()


    if not existing_user:

        return {
            "error": "User not found"
        }


    if not bcrypt.checkpw(
        user.password.encode("utf-8"),
        existing_user.password.encode("utf-8")
    ):

        return {
            "error": "Incorrect password"
        }


    token = create_token(existing_user.id)


    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "username": existing_user.username
    }


# ---------------- GET INTERNSHIPS ----------------

@app.get("/internships")
def get_internships(
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    return db.query(InternshipDB).filter(
        InternshipDB.user_id == current_user
    ).all()


# ---------------- ADD INTERNSHIP ----------------

@app.post("/internships")
def add_internship(
    internship: Internship,
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    new_internship = InternshipDB(

        company=internship.company,

        role=internship.role,

        status=internship.status,

        application_date=internship.application_date,

        user_id=current_user
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

    db: Session = Depends(get_db)
):

    existing = db.query(InternshipDB).filter(

        InternshipDB.id == internship_id,

        InternshipDB.user_id == current_user

    ).first()


    if not existing:

        return {
            "error": "Internship not found"
        }


    existing.company = internship.company

    existing.role = internship.role

    existing.status = internship.status

    existing.application_date = internship.application_date


    db.commit()

    db.refresh(existing)


    return existing


# ---------------- DELETE INTERNSHIP ----------------

@app.delete("/internships/{internship_id}")
def delete_internship(

    internship_id: int,

    current_user: int = Depends(get_current_user),

    db: Session = Depends(get_db)
):

    existing = db.query(InternshipDB).filter(

        InternshipDB.id == internship_id,

        InternshipDB.user_id == current_user

    ).first()


    if not existing:

        return {
            "error": "Internship not found"
        }


    db.delete(existing)

    db.commit()


    return {
        "message": "Internship deleted"
    }