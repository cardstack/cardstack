#!/usr/bin/env python3

import pytest
from cardpay_reward_api.database import Base
from cardpay_reward_api.indexer import Indexer
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .mocks import extra_one_merkle_roots, merkle_roots, reward_programs

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture()
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def indexer(request, monkeypatch):
    monkeypatch.setattr(
        Indexer,
        "get_merkle_roots",
        lambda a, reward_program_id, payment_cycle: roots_for_program(
            reward_program_id, payment_cycle
        ),
    )
    monkeypatch.setattr(Indexer, "get_reward_programs", lambda x: reward_programs)
    return Indexer(None, request.param)


def roots_for_program(reward_program_id, payment_cycle):
    """
    models get_merkle_roots
    """
    if reward_program_id == "0x5E4E148baae93424B969a0Ea67FF54c315248BbA":
        return merkle_roots
    else:
        return []


def extra_one_merkle_roots_for_program(reward_program_id, payment_cycle):
    """
    models get_merkle_roots
    """
    if reward_program_id == "0x5E4E148baae93424B969a0Ea67FF54c315248BbA":
        return extra_one_merkle_roots
    else:
        return []
