#!/usr/bin/env python3

import os

import boto3
import pyarrow.parquet as pq
import sqlalchemy.orm
from boto3.session import Session
from cardpay_reward_indexer.config import config
from cardpay_reward_indexer.models import Proof, Root
from cloudpathlib import AnyPath, S3Client
from sqlalchemy import create_engine

from .utils import get_all_reward_outputs


def check_sync(db_string: str, env: str):
    engine = create_engine(db_string)
    db = sqlalchemy.orm.Session(engine)
    # https://docs.sqlalchemy.org/en/14/faq/sessions.html#my-query-does-not-return-the-same-number-of-objects-as-query-count-tells-me-why
    # count returns ALL elements
    # all returns deduplicated elements
    with db.begin():
        db_root_count = db.query(Root).count()
        db_proof_count = db.query(Proof).count()

    cached_client = S3Client(
        local_cache_dir=".cache",
        boto3_session=Session(),
    )
    cached_client.set_as_default_client()
    rewards_bucket_path = AnyPath(config[env]["rewards_bucket"])
    outputs = get_all_reward_outputs(rewards_bucket_path)
    root_count = 0
    proof_count = 0
    for output in outputs:
        print(
            f"reward program: {output['reward_program_id']} payment_cycle: {output['payment_cycle']}"
        )
        root_count = root_count + 1
        n_row = pq.read_metadata(output["file"]).num_rows
        proof_count = proof_count + n_row

    print(f"=======IN S3=========")
    print(f"Number of Roots:  {root_count}")
    print(f"Number of Proofs: {proof_count}")
    print(f"=======IN DB=========")
    print(f"Number of Roots:  {db_root_count}")
    print(f"Number of Proofs: {db_proof_count}")
    print(f"======= DIFF =========")
    print(f"Number of Roots:  {root_count-db_root_count}")
    print(f"Number of Proofs: {proof_count-db_proof_count}")


if __name__ == "__main__":
    check_sync(
        db_string=os.getenv(
            "DB_STRING", "postgresql://postgres@localhost:5432/postgres"
        ),
        env=os.getenv("ENVIRONMENT", "staging"),
    )
