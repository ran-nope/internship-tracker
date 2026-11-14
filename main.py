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


from config import SECRET_KEY, ALGORITHM, CORS_ORIGINS
from schemas import SignupUser as User, Internship
from auth import router as auth_router, get_current_user, get_db, create_token, signup, commit_internship
from routes.internships import router as internship_router
from throttling import AuthThrottle
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
app.add_middleware(AuthThrottle, attempts=int(os.environ.get('AUTH_RATE_LIMIT', '10')))
app.include_router(auth_router)
app.include_router(internship_router)

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


# Wrap the entire application so even unhandled server errors have CORS headers.
app = CORSMiddleware(
    app=app,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
