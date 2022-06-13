#!/usr/bin/env python3

import pytest
from cardpay_reward_api.config import get_settings
from cardpay_reward_api.database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

settings = get_settings()
settings.ENVIRONMENT = "test"
settings.SUBGRAPH_URL = (
    "https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol",
)
settings.REWARDS_BUCKET = "tests/resources"
settings.DB_STRING = "sqlite:///./test.db"

engine = create_engine(settings.DB_STRING, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()
