#!/usr/bin/env python3

import pytest
from cardpay_reward_api.database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# https://fastapi.tiangolo.com/advanced/testing-database/
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
# SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"  # using store in memory

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

    # @patch.object(Indexer, "get_merkle_roots", side_effect=roots_for_program)
    # @patch.object(Indexer, "get_reward_programs", return_value=reward_programs)
    #


# Base.metadata.drop_all(
#     bind=engine
# )  # drop all tables that have been created (https://stackoverflow.com/questions/67255653/how-to-set-up-and-tear-down-a-database-between-tests-in-fastapi)
# Base.metadata.create_all(bind=engine)


# https://stackoverflow.com/questions/67255653/how-to-set-up-and-tear-down-a-database-between-tests-in-fastapi
@pytest.fixture()
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
