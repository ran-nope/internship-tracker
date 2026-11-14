import os
import logging
from urllib.parse import urlsplit
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing from your .env file")

logger = logging.getLogger('uvicorn.error')


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
