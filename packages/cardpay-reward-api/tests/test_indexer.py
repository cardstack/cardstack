# #!/usr/bin/env python3

#!/usr/bin/env python3
from datetime import datetime

import pytest
from cardpay_reward_api.database import Base
from cardpay_reward_api.indexer import Indexer
from cardpay_reward_api.main import app, get_db
from cardpay_reward_api.models import Proof, Root
from fastapi.testclient import TestClient
from sqlalchemy import exc

from .fixtures import (engine, extra_one_merkle_roots_for_program,
                       extra_one_merkle_roots_old_file_written,
                       extra_one_merkle_roots_without_s3, indexer,
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
    "indexer, n_roots,n_proofs",
    [([], 4, 41), (["0x5E4E148baae93424B969a0Ea67FF54c315248BbA"], 1, 0)],
    indirect=["indexer"],
)
def test_index_only_archived_reward_program(indexer, n_roots, n_proofs, mock_db):
    indexer.run(mock_db, REWARDS_BUCKET)
    with mock_db.begin():
        roots = mock_db.query(Root).all()
        proofs = mock_db.query(Proof).all()
    assert len(roots) == n_roots
    assert len(proofs) == n_proofs


@pytest.mark.parametrize(
    "indexer", [["0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07"]], indirect=["indexer"]
)
def test_index_new_root(indexer, mock_db, monkeypatch):
    indexer.run(mock_db, REWARDS_BUCKET)
    monkeypatch.setattr(
        Indexer,
        "get_merkle_roots",
        lambda _, reward_program_id, payment_cycle: extra_one_merkle_roots_for_program(
            reward_program_id, payment_cycle
        ),
    )
    indexer.run(mock_db, REWARDS_BUCKET)
    with mock_db.begin():
        roots = mock_db.query(Root).all()
        proofs = mock_db.query(Proof).all()
    assert len(roots) == 5
    assert len(proofs) == 44


@pytest.mark.parametrize("indexer", [[]], indirect=["indexer"])
def test_should_not_index_new_root_without_s3(indexer, mock_db, monkeypatch):
    indexer.run(mock_db, REWARDS_BUCKET)
    monkeypatch.setattr(
        Indexer,
        "get_merkle_roots",
        lambda _, reward_program_id, payment_cycle: extra_one_merkle_roots_without_s3(
            reward_program_id, payment_cycle
        ),
    )
    with mock_db.begin():
        roots = mock_db.query(Root).all()
        proofs = mock_db.query(Proof).all()
        block_number = (
            mock_db.query(Root)
            .filter(
                Root.rewardProgramId == "0x5E4E148baae93424B969a0Ea67FF54c315248BbA"
            )
            .order_by(Root.blockNumber.desc())
            .first()
        ).blockNumber
    assert len(roots) == 4
    assert len(proofs) == 41
    assert block_number == 26778059


@pytest.mark.parametrize("indexer", [[]], indirect=["indexer"])
def test_should_not_index_root_with_old_file_written(indexer, mock_db, monkeypatch):
    indexer.run(mock_db, REWARDS_BUCKET)
    monkeypatch.setattr(
        Indexer,
        "get_merkle_roots",
        lambda _, reward_program_id, payment_cycle: extra_one_merkle_roots_old_file_written(
            reward_program_id, payment_cycle
        ),
    )
    with pytest.raises(
        exc.IntegrityError, match=r".* UNIQUE constraint failed: proofs.leaf"
    ):
        indexer.run(mock_db, REWARDS_BUCKET)
