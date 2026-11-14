from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import SessionLocal
from models import UserDB
from config import SECRET_KEY, ALGORITHM
from schemas import SignupUser, LoginUser
router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='auth/login')

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


# ---------------- SIGNUP ----------------

@router.post("/auth/signup")
@router.post("/signup", include_in_schema=False)
def signup(user: SignupUser, db: Session = Depends(get_db)):
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

@router.post("/auth/login")
@router.post("/login", include_in_schema=False)
def login(user: LoginUser, db: Session = Depends(get_db)):
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
