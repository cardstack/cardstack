import json
from typing import Optional

import boto3
import typer
from boto3.session import Session
from cardpay_reward_programs.config import config
from cardpay_reward_programs.payment_tree import PaymentTree
from cardpay_reward_programs.rules import FlatPayment
from cardpay_reward_programs.utils import write_parquet_file
from cloudpathlib import AnyPath, S3Client
from scripts.utils import EMPTY_MARKER_HEX, NULL_HEX, Environment
from web3 import Web3


def flat_drop(
    env: Environment = Environment.staging,
    parameters_file_path: Optional[str] = typer.Argument(
        None, help="file path to parameters file"
    ),
):
    env = env.value
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
    with open("scripts/abis/RewardPool.json") as contract_file:
        abi_file = json.load(contract_file)
    reward_contract = w3.eth.contract(
        address=config[env]["contracts"]["reward_pool"], abi=abi_file["abi"]
    )

    if parameters_file_path is None:

        params = {
            "core": {
                "payment_cycle_length": 32768,
                "start_block": 24000000,
                "end_block": 26000000,
                "subgraph_config_locations": {},
                "duration": 777600,
            },
            "user_defined": {
                "reward_per_user": reward_amount,
                "token": config[env]["tokens"]["card"],
                "accounts": default_accounts,
            },
            "run": {
                "reward_program_id": config[env]["reward_program"],
                "payment_cycle": w3.eth.get_block_number(),
            },
            "metadata": {"explanation_id": "flat_payment"},
        }

    else:
        with open(parameters_file_path) as f:
            params = json.load(f)
    rule = FlatPayment(params["core"], params["user_defined"])
    payment_list = rule.get_payments(
        params["run"]["payment_cycle"], params["run"]["reward_program_id"]
    )
    tree = PaymentTree(payment_list.to_dict("records"), params)
    table = tree.as_arrow()
    existing_root = reward_contract.caller.payeeRoots(
        params["run"]["reward_program_id"], params["run"]["payment_cycle"]
    )
    if (
        existing_root == tree.get_hex_root()
        or existing_root != NULL_HEX
        or existing_root == EMPTY_MARKER_HEX
    ):
        raise Exception(
            f"Root has already been taken for payment cycle {params['run']['payment_cycle']}"
        )

    rewards_bucket = config[env]["rewards_bucket"]
    output_location = f"{rewards_bucket}/rewardProgramID={params['run']['reward_program_id']}/paymentCycle={params['run']['payment_cycle']}"
    output_path = AnyPath(output_location)
    print(
        f"Writing flat drop of {len(params['user_defined']['accounts'])} accounts to {output_location}"
    )
    if output_path.exists():
        raise Exception(f"{output_location} already exists")
    else:
        write_parquet_file(output_path, table)
    print("Done")


if __name__ == "__main__":
    typer.run(flat_drop)
