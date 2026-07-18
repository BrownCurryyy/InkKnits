# InkKnits Backend

This folder contains the initial FastAPI + SQLAlchemy backend scaffold for InkKnits.

## Structure

- app/: FastAPI application entrypoints
- database/: SQLAlchemy engine, session, and shared base model
- models/: domain models
- repositories/: repository layer abstractions

## Getting started

1. Create and activate a virtual environment.
2. Install dependencies: `pip install -r requirements.txt`
3. Start the API: `uvicorn app.main:app --reload`
