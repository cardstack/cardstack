#!/usr/bin/env python3
import os

from dotenv import load_dotenv
from fastapi_utils.session import FastAPISessionMaker
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()
DB_STRING = os.environ.get("DB_STRING")

engine = create_engine(DB_STRING)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_fastapi_sessionmaker() -> FastAPISessionMaker:
    """This function could be replaced with a global variable if preferred"""
    return FastAPISessionMaker(DB_STRING)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
