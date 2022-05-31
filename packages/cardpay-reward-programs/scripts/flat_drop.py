#!/usr/bin/env python3

import json
import os
from enum import Enum
from typing import Optional

import boto3
import pyarrow.parquet as pq
import typer
from boto3.session import Session
from cardpay_reward_programs.config import config
from cardpay_reward_programs.payment_tree import PaymentTree
from cardpay_reward_programs.rules import FlatPayment
from cardpay_reward_programs.rules.flat_payment import FlatPayment
from cardpay_reward_programs.utils import (write_parameters_file,
                                           write_parquet_file)
from cloudpathlib import AnyPath, S3Client
from dotenv import load_dotenv
from web3 import Web3


class Environment(str, Enum):
    staging = "staging"
    production = "production"


def flat_drop(
    env: Environment = typer.Argument(
        default=Environment.staging, help="staging or production"
    ),
    parameters_file_path: Optional[str] = typer.Argument(
        None, help="file path to parameters file"
    ),
):
    reward_amount = 10_000_000_000_000_000_000  # 10 eth
    default_accounts = ["0x159ADe032073d930E85f95AbBAB9995110c43C71"]

    secrets_client = boto3.client("secretsmanager")
    cached_client = S3Client(
        local_cache_dir=".cache",
        boto3_session=Session(),
    )
    cached_client.set_as_default_client()

    evm_full_node_url = secrets_client.get_secret_value(
        SecretId=f"{env}_evm_full_node_url"
    )["SecretString"]
    # Make sure evm node corresponds to the environment
    w3 = Web3(Web3.HTTPProvider(evm_full_node_url))

    if parameters_file_path is None:

        params = {
            "core": {
                "payment_cycle_length": 32768,
                "start_block": 24000000,
                "end_block": 26000000,
                "subgraph_config_locations": {},
            },
            "user_defined": {
                "reward_per_user": reward_amount,
                "token": config[env]["tokens"]["card"],
                "duration": 777600,
                "accounts": default_accounts,
            },
            "run": {
                "reward_program_id": config[env]["reward_program"],
                "payment_cycle": w3.eth.get_block_number(),
            },
        }

    else:
        with open(parameters_file_path) as f:
            params = json.load(f)

    rule = FlatPayment(params["core"], params["user_defined"])
    payment_list = rule.run(
        params["run"]["payment_cycle"], params["run"]["payment_cycle"]
    )
    tree = PaymentTree(payment_list.to_dict("records"))
    table = tree.as_arrow()

    rewards_bucket = config[env]["rewards_bucket"]
    output_location = f"{rewards_bucket}/rewardProgramID={reward_program_id}/paymentCycle={payment_cycle}"
    output_path = AnyPath(output_location)

    print(
        f"Writing flat drop of {len(params['user_defined']['accounts'])} accounts to {output_location}"
    )
    if output_path.exists():
        raise Exception(f"{output_location} already exists")
    else:
        write_parquet_file(output_path, table)
        write_parameters_file(output_path, o)
    print("Done")


if __name__ == "__main__":
    typer.run(flat_drop)
