import json
import logging
import os
from typing import List

import sentry_sdk
import uvicorn
from fastapi import Depends, FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from web3 import Web3

from . import crud, schemas
from .config import config, get_settings

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL)

settings = get_settings()
engine = create_engine(settings.DB_STRING)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI()


def get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_w3():
    w3 = Web3(Web3.HTTPProvider(settings.EVM_FULL_NODE_URL))
    yield w3


def get_reward_pool(w3=Depends(get_w3)):
    with open("abis/reward-pool.json") as contract_file:
        contract = json.load(contract_file)
    reward_contract = w3.eth.contract(
        address=config[settings.ENVIRONMENT]["reward_pool"], abi=contract
    )
    yield reward_contract


if settings.SENTRY_DSN is not None:
    sentry_sdk.init(
        settings.SENTRY_DSN,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0,
        environment=settings.ENVIRONMENT,
    )


def param(skip: int = 0, limit: int = 100):
    return {"skip": skip, "limit": limit}


@app.get("/about/")
async def about():
    return {
        "subgraph_url": settings.SUBGRAPH_URL,
        "rewards_bucket": settings.REWARDS_BUCKET,
        "environment": settings.ENVIRONMENT,
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


@app.get(
    "/reward-pool-balance/{rewardProgramId}/{token}",
    response_model=schemas.RewardPoolBalance,
)
def read_reward_pool_balance(
    rewardProgramId: str,
    token: str,
    reward_pool=Depends(get_reward_pool),
):
    balance_in_wei = reward_pool.caller.rewardBalance(rewardProgramId, token)
    return {
        "rewardProgramId": rewardProgramId,
        "token": token,
        "balanceInEth": Web3.fromWei(balance_in_wei, "ether"),
    }


if __name__ == "__main__":
    uvicorn.run("cardpay_reward_api.main:app", host="0.0.0.0", log_level="info")
