# #!/usr/bin/env python3

#!/usr/bin/env python3
from datetime import datetime

import pytest
from cardpay_reward_api.database import Base, get_db
from cardpay_reward_api.indexer import Indexer
from cardpay_reward_api.main import app
from cardpay_reward_api.models import Root
from fastapi.testclient import TestClient

from .fixtures import (engine, extra_one_merkle_roots_for_program, indexer,
                       override_get_db)
from .mocks import merkle_roots, reward_programs
from .utils import (check_duplicates_for_proofs, check_duplicates_for_roots,
                    validate_proof_response_fields)

REWARDS_BUCKET = "tests/resources"
ENVIRONMENT = "local"

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture()
def mock_db():
    # setup
    Base.metadata.create_all(bind=engine)  # create tables
    db = next(override_get_db())
    yield db
    # teardown
    # https://stackoverflow.com/questions/67255653/how-to-set-up-and-tear-down-a-database-between-tests-in-fastapi
    Base.metadata.drop_all(bind=engine)  # drop tables


@pytest.mark.parametrize(
    "indexer, n_roots",
    [([], 3), (["0x5E4E148baae93424B969a0Ea67FF54c315248BbA"], 0)],
    indirect=["indexer"],
)
def test_index_only_archived_reward_program(indexer, n_roots, mock_db):
    indexer.run(mock_db, REWARDS_BUCKET)
    roots = mock_db.query(Root).all()

    assert len(roots) == n_roots


@pytest.mark.parametrize("indexer", [[]], indirect=["indexer"])
def test_index_from_last_payment_cycle(indexer, mock_db, monkeypatch):
    indexer.run(mock_db, REWARDS_BUCKET)
    with mock_db.begin():
        roots = mock_db.query(Root).all()
    assert len(roots) == 3
    monkeypatch.setattr(
        Indexer,
        "get_merkle_roots",
        lambda a, reward_program_id, payment_cycle: extra_one_merkle_roots_for_program(
            reward_program_id, payment_cycle
        ),
    )
    indexer.run(mock_db, REWARDS_BUCKET)
    with mock_db.begin():
        roots = mock_db.query(Root).all()
    assert len(roots) == 4
