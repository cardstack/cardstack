import logging
import os
from typing import List, Optional

import sentry_sdk
import uvicorn
from fastapi import Depends, FastAPI, HTTPException
from fastapi_utils.session import FastAPISessionMaker
from fastapi_utils.tasks import repeat_every
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from . import crud, models, schemas
from .config import config, get_settings
from .indexer import Indexer

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL)

settings = get_settings()
engine = create_engine(settings.DB_STRING)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
models.Base.metadata.create_all(bind=engine)

app = FastAPI()


def get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_fastapi_sessionmaker() -> FastAPISessionMaker:
    """This function could be replaced with a global variable if preferred"""
    return FastAPISessionMaker(settings.DB_STRING)


if settings.SENTRY_DSN is not None:
    sentry_sdk.init(
        settings.SENTRY_DSN,
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
            Indexer(
                settings.SUBGRAPH_URL,
                config[settings.ENVIRONMENT]["archived_reward_programs"],
            ).run(db=db, storage_location=settings.REWARDS_BUCKET)
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
