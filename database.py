import os
from dotenv import load_dotenv
from db_runtime import build_engine, build_session_factory
from maintenance import RuntimeSettings
from schema import Base

load_dotenv()

RUNTIME = RuntimeSettings.from_environment(os.environ)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing from your .env file")

engine = build_engine(DATABASE_URL, RUNTIME)
SessionLocal = build_session_factory(engine, RUNTIME.maintenance_mode)
