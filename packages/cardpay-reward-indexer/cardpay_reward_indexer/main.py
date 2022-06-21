#!/usr/bin/env python3
import logging
import os
import time

import schedule
import sentry_sdk
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from . import models
from .config import config, get_settings
from .indexer import Indexer

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL)

settings = get_settings()
engine = create_engine(settings.DB_STRING)
models.Base.metadata.create_all(bind=engine)

if settings.SENTRY_DSN is not None:
    sentry_sdk.init(
        settings.SENTRY_DSN,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0,
        environment=settings.ENVIRONMENT,
    )


def model_exists(db, model_class):
    engine = db.get_bind()
    return model_class.metadata.tables[model_class.__tablename__].exists(engine)


def run_task(indexer, storage_location):
    """
    Opens and close single db connection per indexing task
    """
    try:
        with Session(engine) as db:
            if model_exists(db, models.Proof) and model_exists(db, models.Root):
                indexer.run(db, storage_location)
            else:
                logging.info("No tables exist")
    except Exception as e:
        logging.error(e)


def run_all():
    # create session and add objects
    indexer = Indexer(
        settings.SUBGRAPH_URL,
        config[settings.ENVIRONMENT]["archived_reward_programs"],
    )

    frequency = 5  # 5 seconds
    schedule.every(frequency).seconds.do(run_task, indexer, settings.REWARDS_BUCKET)
    schedule.run_all()
    # Go into an infinite loop
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    run_all()
