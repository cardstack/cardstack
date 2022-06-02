#!/usr/bin/env python3


import re

import pytest
from cardpay_reward_api.database import Base, get_db
from cardpay_reward_api.indexer import Indexer
from cardpay_reward_api.main import app
from cardpay_reward_api.models import Root
from cloudpathlib.local.implementations.s3 import LocalS3Client
from fastapi.testclient import TestClient
from mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .mocks import merkle_roots, reward_programs

# https://fastapi.tiangolo.com/advanced/testing-database/
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
# SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"  # using store in memory

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base.metadata.drop_all(
#     bind=engine
# )  # drop all tables that have been created (https://stackoverflow.com/questions/67255653/how-to-set-up-and-tear-down-a-database-between-tests-in-fastapi)
# Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


# https://stackoverflow.com/questions/67255653/how-to-set-up-and-tear-down-a-database-between-tests-in-fastapi
@pytest.fixture()
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def is_hex_string(s):
    pattern = "0x([0-9a-fA-F]+)$"
    return bool(re.match(pattern, s))


def validate_proof_response_fields(o):
    return


SUBGRAPH_URL = "https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol"
REWARDS_BUCKET = "s3://tally-staging-reward-programs"
DB_STRING = "postgresql://postgres@localhost:5432/postgres"
ENVIRONMENT = "staging"


def roots_for_program(*args, **kwargs):
    if args[0] == "0x5E4E148baae93424B969a0Ea67FF54c315248BbA":
        return merkle_roots
    else:
        return []


@patch.object(Indexer, "get_merkle_roots", side_effect=roots_for_program)
@patch.object(Indexer, "get_reward_programs", return_value=reward_programs)
def test_read_roots(get_merkle_roots, get_reward_programs, test_db):
    db = next(override_get_db())
    Indexer(SUBGRAPH_URL, []).run(db, REWARDS_BUCKET)
    roots = db.query(Root).all()
    assert len(roots) == 3
    payment_cycles = set()
    for root in roots:
        payment_cycles.add(root.paymentCycle)
    len(payment_cycles) == 3


@patch.object(Indexer, "get_merkle_roots", side_effect=roots_for_program)
@patch.object(Indexer, "get_reward_programs", return_value=reward_programs)
def test_read_proof(get_merkle_roots, get_reward_programs, test_db):
    db = next(override_get_db())
    Indexer(SUBGRAPH_URL, []).run(db, REWARDS_BUCKET)
    response = client.get("/merkle-proofs/0x159ADe032073d930E85f95AbBAB9995110c43C71")
    assert len(response.json()) == 3
    for o in response.json():
        assert is_hex_string(o["payee"])


# @patch.object(Indexer, "get_merkle_roots", side_effect=roots_for_program)
# @patch.object(Indexer, "get_reward_programs", return_value=reward_programs)
# def test_reward_program_archived(get_merkle_roots, get_reward_programs, test_db):
#     db = next(override_get_db())
#     Indexer(SUBGRAPH_URL, ["0x5E4E148baae93424B969a0Ea67FF54c315248BbA"]).run(
#         db, REWARDS_BUCKET
#     )
#     response = client.get("/merkle-proofs/0x159ADe032073d930E85f95AbBAB9995110c43C71")
#     assert len(response.json()) == 0
