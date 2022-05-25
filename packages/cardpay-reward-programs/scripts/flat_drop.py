#!/usr/bin/env python3

import os

import pyarrow.parquet as pq
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

# ATTENTION!
# Please ensure EVM_FULL_NODE_URL corresponds to the ENVIRONMENT

load_dotenv()
cached_client = S3Client(
    local_cache_dir=".cache",
    boto3_session=Session(),
)
cached_client.set_as_default_client()

reward_amount = 10_000_000_000_000_000_000  # 10 eth

for expected_env in ["EVM_FULL_NODE_URL", "ENVIRONMENT"]:
    if expected_env not in os.environ:
        raise ValueError(f"Missing environment variable {expected_env}")

# Make sure evm node corresponds to the environment
w3 = Web3(Web3.HTTPProvider(os.getenv("EVM_FULL_NODE_URL")))
env = os.getenv("ENVIRONMENT")


def flat_drop():

    core_parameters = {
        "payment_cycle_length": 32768,
        "start_block": 24000000,
        "end_block": 26000000,
        "subgraph_config_locations": {},
    }  # all core parameters not needed
    user_defined_parameters = {
        "reward_per_user": reward_amount,
        "token": config[env]["tokens"]["card"],
        "duration": 777600,
        "accounts": ["0x159ADe032073d930E85f95AbBAB9995110c43C71"],
    }
    reward_program_id = config[env]["reward_program"]
    payment_cycle = w3.eth.get_block_number()  # current block number
    run = {"reward_program_id": reward_program_id, "payment_cycle": payment_cycle}
    o = {"core": core_parameters, "user_defined": user_defined_parameters, "run": run}
    rule = FlatPayment(core_parameters, user_defined_parameters)
    payment_list = rule.run(payment_cycle, reward_program_id)

    rewards_bucket = config[env]["rewards_bucket"]
    output_location = f"{rewards_bucket}/rewardProgramID={reward_program_id}/paymentCycle={payment_cycle}"

    print(
        f"Writing flat drop of {len(user_defined_parameters['accounts'])} accounts to {output_location}"
    )
    tree = PaymentTree(payment_list.to_dict("records"))
    table = tree.as_arrow()
    output_path = AnyPath(output_location)
    if output_path.exists():
        raise Exception(f"{output_location} already exists")
    else:
        write_parquet_file(output_path, table)
        write_parameters_file(output_path, o)
    print("Done")


if __name__ == "__main__":
    flat_drop()
