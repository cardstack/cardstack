import logging
import os
import sentry_sdk
import re

from .contracts import RewardPool
import pyarrow.parquet as pq
from hexbytes import HexBytes
from web3 import Web3

NULL_HEX = HexBytes(
    "0x0000000000000000000000000000000000000000000000000000000000000000"
)

EMPTY_MARKER_HEX = HexBytes(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
)


def setup_logging(config):
    logging.basicConfig(level=config.log_level.upper())


def setup_sentry(config):
    if config.reward_root_submitter_sentry_dsn is not None:
        sentry_sdk.init(
            SENTRY_DSN,
            # Set traces_sample_rate to 1.0 to capture 100%
            # of transactions for performance monitoring.
            # We recommend adjusting this value in production.
            traces_sample_rate=1.0,
            environment=config.environment,
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


def process_file(reward_output_filename, config):
    evm_node = config.evm_full_node_url
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

    reward_pool_contract = RewardPool(w3, config.environment)
    reward_pool_contract.submit_merkle_root(
        reward_program_id,
        payment_cycle,
        root,
        config.reward_root_submitter_address,
        config.reward_root_submitter_private_key,
    )
