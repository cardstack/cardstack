import logging
import os
from typing import List, Optional

import sentry_sdk
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi_utils.session import FastAPISessionMaker
from fastapi_utils.tasks import repeat_every
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from . import crud, models, schemas
from .config import config
from .indexer import Indexer

load_dotenv()

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL)


for expected_env in [
    "SUBGRAPH_URL",
    "REWARDS_BUCKET",
    "ENVIRONMENT",
    "DB_STRING",
]:
    if expected_env not in os.environ:
        raise ValueError(f"Missing environment variable {expected_env}")

SUBGRAPH_URL = os.environ.get("SUBGRAPH_URL")
REWARDS_BUCKET = os.environ.get("REWARDS_BUCKET")
ENVIRONMENT = os.environ.get("ENVIRONMENT")
DB_STRING = os.environ.get("DB_STRING")
SENTRY_DSN = os.environ.get("SENTRY_DSN")

engine = create_engine(DB_STRING)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
models.Base.metadata.create_all(bind=engine)


def get_fastapi_sessionmaker() -> FastAPISessionMaker:
    """This function could be replaced with a global variable if preferred"""
    return FastAPISessionMaker(DB_STRING)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app = FastAPI()

if SENTRY_DSN is not None:
    sentry_sdk.init(
        SENTRY_DSN,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0,
        environment=ENVIRONMENT,
    )


@app.on_event("startup")
@repeat_every(seconds=5, raise_exceptions=True)
def index_root_task() -> None:
    sessionmaker = get_fastapi_sessionmaker()
    with sessionmaker.context_session() as db:
        try:
            Indexer(SUBGRAPH_URL, config[ENVIRONMENT]["archived_reward_programs"]).run(
                db=db, storage_location=REWARDS_BUCKET
            )
        except Exception as e:
            logging.error(e)


def param(skip: int = 0, limit: int = 100):
    return {"skip": skip, "limit": limit}


@app.get("/about/")
async def about():
    return {
        "subgraph_url": SUBGRAPH_URL,
        "rewards_bucket": REWARDS_BUCKET,
        "environment": ENVIRONMENT,
    }


@app.get("/")
async def root():
    return {"status": "ok"}


@app.get("/merkle-proofs/{payee}", response_model=List[schemas.Proof])
def read_proofs(
    db: Session = Depends(get_db),
    proof_filter: dict = Depends(schemas.ProofFilter),
    param: dict = Depends(param),
):
    return crud.get_proofs(db, proof_filter=proof_filter, param=param)


if __name__ == "__main__":
    uvicorn.run("cardpay_reward_api.main:app", host="0.0.0.0", log_level="info")
