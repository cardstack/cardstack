import logging
import os
import urllib.parse
import sentry_sdk
import re
import boto3
from functools import lru_cache

import pyarrow.parquet as pq
from cloudpathlib import AnyPath
from hexbytes import HexBytes
from web3 import Web3
from eth_utils import to_wei
import requests
import json
from dotenv import load_dotenv
from web3 import Web3

NULL_HEX = HexBytes(
    "0x0000000000000000000000000000000000000000000000000000000000000000"
)

EMPTY_MARKER_HEX = HexBytes(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
)

load_dotenv()  # take environment variables from .env


if "ENVIRONMENT" not in os.environ:
    raise ValueError(f"Missing environment variable ENVIRONMENT")
ENVIRONMENT = os.getenv("ENVIRONMENT")

if ENVIRONMENT == "staging":
    REWARD_POOL_ADDRESS = "0xc9A238Ee71A65554984234DF9721dbdA873F84FA"


@lru_cache()
def get_secret(secret_name):
    client = boto3.client("secretsmanager")
    return client.get_secret_value(SecretId=f"{ENVIRONMENT}_{secret_name}")[
        "SecretString"
    ]


LOGLEVEL = os.environ.get("LOGLEVEL", "WARNING").upper()
logging.basicConfig(level=LOGLEVEL)
SENTRY_DSN = os.environ.get("SENTRY_DSN")
if SENTRY_DSN is not None:
    sentry_sdk.init(
        SENTRY_DSN,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0,
        environment=os.environ.get("ENVIRONMENT"),
    )


def safe_regex_group_search(regex, string, group):
    """
    Returns None in the case of a missing group
    """
    match = re.search(regex, string)
    if match:
        return match.group(group)
    else:
        return None


def get_gas_price(speed="average"):
    gas_price_oracle = "https://blockscout.com/xdai/mainnet/api/v1/gas-price-oracle"
    current_values = requests.get(gas_price_oracle).json()
    gwei = current_values[speed]
    return to_wei(gwei, "gwei")


def submit_root(
    reward_program_id, payment_cycle, root, w3, reward_contract, owner, private_key
):
    transaction_count = w3.eth.get_transaction_count(owner)
    tx = reward_contract.functions.submitPayeeMerkleRoot(
        reward_program_id, payment_cycle, root
    ).buildTransaction(
        {
            "from": owner,
            "nonce": transaction_count,
            "gasPrice": get_gas_price(),
        }
    )
    signed_tx = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    tx_receipt = w3.eth.wait_for_transaction_receipt(
        tx_hash, timeout=240
    )  # there is a timeout to this
    if tx_receipt["status"] == 1:
        logging.info(f"Merkle Root written! See transaction {tx_hash.hex()}")
        return tx_hash
    else:
        raise Exception(
            f"Transaction Receipt with status 0.Transaction receipt: {tx_receipt}"
        )


def process_file(reward_output_filename):
    evm_node = get_secret("evm_full_node_url")
    w3 = Web3(Web3.HTTPProvider(evm_node))

    reward_program_id = safe_regex_group_search(
        r"rewardProgramID=([^/]*)", str(reward_output_filename), 1
    )
    if not w3.isChecksumAddress(reward_program_id):
        raise Exception(
            f"{reward_output_filename} does not have a valid checksummed address for the reward program ID"
        )
    payment_cycle = safe_regex_group_search(
        r"paymentCycle=(\d*)", str(reward_output_filename), 1
    )
    if not (payment_cycle or "").isdigit():
        raise Exception(
            f"{reward_output_filename} does not have a valid payment cycle, should be not blank and a number"
        )
    with reward_output_filename.open("rb") as pf:
        payment_file = pq.ParquetFile(pf)
        # Read only a single row and a single column
        try:
            file_start = next(payment_file.iter_batches(batch_size=1))
            first_row = file_start.to_pylist()[0]
            root = HexBytes(first_row["root"])
            if HexBytes(reward_program_id) != HexBytes(first_row["rewardProgramID"]):
                raise Exception(
                    f"{reward_output_filename} reward program ID in path and in the file do not match"
                )
            if payment_cycle != str(first_row["paymentCycle"]):
                raise Exception(
                    f"{reward_output_filename} payment cycle in path and in the file do not match"
                )
            payment_cycle = int(payment_cycle)
        except StopIteration:
            root = EMPTY_MARKER_HEX

    owner = get_secret("reward_root_submitter_address")
    private_key = get_secret("reward_root_submitter_private_key")
    reward_contract_address = REWARD_POOL_ADDRESS

    with open(f"abis/RewardPool.json") as contract_file:
        contract = json.load(contract_file)
        reward_contract = w3.eth.contract(
            address=reward_contract_address, abi=contract["abi"]
        )

    submit_root(
        reward_program_id, payment_cycle, root, w3, reward_contract, owner, private_key
    )


def handler(event, _context):
    bucket = event["Records"][0]["s3"]["bucket"]["name"]
    key = urllib.parse.unquote_plus(
        event["Records"][0]["s3"]["object"]["key"], encoding="utf-8"
    )
    process_file(AnyPath(f"s3://{bucket}/{key}"))
