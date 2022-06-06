#!/usr/bin/env python3

import pytest
from cardpay_reward_api.database import Base
from cardpay_reward_api.indexer import Indexer
from cardpay_reward_api.main import app, get_db
from cardpay_reward_api.models import Root
from fastapi.testclient import TestClient

from .config import engine, override_get_db, settings
from .mocks import reward_programs, roots_for_program
from .utils import (check_duplicates_for_proofs, check_duplicates_for_roots,
                    validate_proof_response_fields)

# this overrides the get_db function yielding a different session with different engine
# it is only needed when using dependencies in fastapi
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(scope="module")
def monkeymodule():
    """
    We need to use monkeypatch when patching a fixture
    But the issue is that, we will always receive a ScopeMismatch error
    when wanting the fixture to run once in a specific scope (in this case a module)
    https://stackoverflow.com/questions/53963822/python-monkeypatch-setattr-with-pytest-fixture-at-module-scope
    """
    from _pytest.monkeypatch import MonkeyPatch

    mpatch = MonkeyPatch()
    yield mpatch
    mpatch.undo()


@pytest.fixture(scope="module")
def indexer(monkeymodule):
    monkeymodule.setattr(
        Indexer,
        "get_merkle_roots",
        lambda a, reward_program_id, payment_cycle: roots_for_program(
            reward_program_id, payment_cycle
        ),
    )
    monkeymodule.setattr(Indexer, "get_reward_programs", lambda x: reward_programs)
    return Indexer(None, [])


@pytest.fixture(scope="module")
def mock_db(monkeymodule, indexer):
    # setup
    Base.metadata.create_all(bind=engine)
    db = next(override_get_db())
    indexer.run(db, settings.REWARDS_BUCKET)
    yield db
    # teardown
    # https://stackoverflow.com/questions/67255653/how-to-set-up-and-tear-down-a-database-between-tests-in-fastapi
    Base.metadata.drop_all(bind=engine)


def test_read_roots(mock_db):
    roots = mock_db.query(Root).all()
    check_duplicates_for_roots(roots)
    assert len(roots) == 4


def test_read_proofs(mock_db):
    response = client.get("/merkle-proofs/0x159ADe032073d930E85f95AbBAB9995110c43C71")
    res = response.json()
    assert len(res) == 3
    validate_proof_response_fields(res)
    check_duplicates_for_proofs(res)
