"""Model metadata without environment loading or database connections."""
from sqlalchemy.orm import declarative_base

Base = declarative_base()
