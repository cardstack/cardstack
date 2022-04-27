#!/usr/bin/env python3
import json
import re
from datetime import datetime

import boto3
import eth_abi
import pyarrow.parquet as pq
import requests
from cloudpathlib import AnyPath
from fastapi import Depends
from hexbytes import HexBytes
from pyarrow import fs
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from . import crud, database, models, schemas

s3 = boto3.client("s3")

# rewardProgramID=0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07/paymentCycle=25650728/results.parquet
uri = AnyPath("s3://tally-staging-reward-programs")


class Indexer:
    def __init__(self, subgraph_url):
        self.subgraph_url = subgraph_url

    def run(self, db: Session, storage_location):
        reward_program_ids = [o["id"] for o in self.get_reward_programs()]
        for reward_program_id in reward_program_ids:
            self.index_for_program(db, reward_program_id, storage_location)

    def index_for_program(self, db: Session, reward_program_id, storage_location):
        with db.begin():
            last_submitted_root_block_number = self.get_last_indexed_root_block_number(
                db, reward_program_id
            )
            print(
                f"Indexing reward program {reward_program_id} since block {last_submitted_root_block_number}"
            )
            print("===Start===")
            new_roots = self.get_merkle_roots(
                reward_program_id, last_submitted_root_block_number
            )
            if len(new_roots) > 0:
                for root in sorted(new_roots, key=lambda x: x["blockNumber"]):
                    s3_path = (
                        storage_location
                        + f"/rewardProgramID={reward_program_id}/paymentCycle={root['paymentCycle']}/results.parquet"
                    )
                    payment_table = pq.read_table(s3_path)
                    payment_list = payment_table.to_pylist()
                    self.add_root_and_proofs(db, root, payment_list)
                db.commit()
            else:
                print("Skipping indexing: No new roots")
            print("===Done===")

    def add_root_and_proofs(self, db: Session, root, payment_list):
        print(f"Indexing {len(payment_list)} proofs for root {root['id']}")
        root = models.Root(
            root_hash=root["id"],
            reward_program_id=root["rewardProgram"]["id"],
            payment_cycle=root["paymentCycle"],
            block_number=root["blockNumber"],
            timestamp=datetime.fromtimestamp(int(root["timestamp"])),
        )
        db.add(root)
        proofs = []
        for payment in payment_list:
            token, amount = self.decode_payment(payment)
            i = models.Proof(
                reward_program_id=payment["rewardProgramID"],
                root_hash=payment["root"],
                leaf=payment["leaf"],
                payment_cycle=payment["paymentCycle"],
                payee=payment["payee"],
                token=token,
                proof_array=payment["proof"],
            )
            proofs.append(i)
        db.bulk_save_objects(proofs)

    def decode_payment(self, payment):
        _, _, _, _, token_type, _, transfer_data = eth_abi.decode_abi(
            ["address", "uint256", "uint256", "uint256", "uint256", "address", "bytes"],
            HexBytes(payment["leaf"]),
        )
        return eth_abi.decode_abi(["address", "uint256"], transfer_data)

    def get_last_indexed_root_block_number(self, db: Session, reward_program_id: str):
        o = (
            db.query(models.Root)
            .filter(models.Root.reward_program_id == reward_program_id)
            .order_by(models.Root.block_number.desc())
            .first()
        )
        return o.block_number if o is not None else 0

    def get_merkle_roots(self, reward_program_id: str, block_number: int):
        query = """
        {
            merkleRootSubmissions(
                where: {
                    rewardProgram: "%s",
                    blockNumber_gt: %d
                },
                orderBy: blockNumber,
                orderDirection: desc
            ){
                id
                blockNumber
                paymentCycle
                rewardProgram {
                    id
                }
                timestamp
            }
        }
        """ % (
            reward_program_id,
            block_number,
        )
        return self.query_subgraph(query)["merkleRootSubmissions"]

    def get_reward_programs(self):
        query = """
        {
            rewardPrograms(
                orderBy: id, orderDirection: desc)
            {
                id
            }
        }
        """
        return self.query_subgraph(query)["rewardPrograms"]

    def query_subgraph(self, query):
        try:
            r = requests.post(
                self.subgraph_url,
                json={"query": query},
            )
            if r.ok:
                json_data = json.loads(r.text)
                return json_data["data"]
            else:
                raise (r.raise_for_status())
        except requests.exceptions.ConnectionError:
            print("Connection error during query subgraph")
        except Exception as e:
            print("Error when querying subgraph")
            raise (e)
