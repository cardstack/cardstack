#!/usr/bin/env python3
import logging
import os
import time

import schedule
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from . import models
from .config import config, get_settings
from .indexer import Indexer

settings = get_settings()
engine = create_engine(settings.DB_STRING)

models.Base.metadata.create_all(bind=engine)

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL)


def run_task(indexer, storage_location):
    """
    Opens and close single db connection per indexing task
    """
    with Session(engine) as db:
        indexer.run(db, storage_location)


def run_all():
    # create session and add objects
    indexer = Indexer(
        settings.SUBGRAPH_URL,
        config[settings.ENVIRONMENT]["archived_reward_programs"],
    )

    # Default to one minute
    frequency = 5
    schedule.every(frequency).seconds.do(run_task, indexer, settings.REWARDS_BUCKET)
    schedule.run_all()
    # Go into an infinite loop
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    run_all()
