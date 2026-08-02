import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
