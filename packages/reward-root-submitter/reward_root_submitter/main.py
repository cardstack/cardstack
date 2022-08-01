from dataclasses import dataclass
import logging
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


@dataclass
class MerkleRoot:
    reward_program_id: str
    payment_cycle: int
    merkle_root_hash: HexBytes


def setup_logging(config):
    logging.basicConfig(level=config.log_level.upper())


def safe_regex_group_search(regex, string, group):
    """
    Returns None in the case of a missing group
    """
    match = re.search(regex, string)
    if match:
        return match.group(group)
    else:
        return None


def get_merkle_root_details(reward_output_filename):

    reward_program_id = safe_regex_group_search(
        r"rewardProgramID=([^/]*)", str(reward_output_filename), 1
    )
    if not Web3().isChecksumAddress(reward_program_id):
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
        except StopIteration:
            root = EMPTY_MARKER_HEX
        payment_cycle = int(payment_cycle)
    return MerkleRoot(
        reward_program_id=reward_program_id,
        payment_cycle=payment_cycle,
        merkle_root_hash=root,
    )


def process_file(reward_output_filename, config):
    evm_node = config.evm_full_node_url
    w3 = Web3(Web3.HTTPProvider(evm_node))

    merkle_root_details = get_merkle_root_details(reward_output_filename)

    reward_pool_contract = RewardPool(w3)
    reward_pool_contract.setup_from_environment(config.environment)
    reward_pool_contract.submit_merkle_root(
        merkle_root_details.reward_program_id,
        merkle_root_details.payment_cycle,
        merkle_root_details.merkle_root_hash,
        config.reward_root_submitter_address,
        config.reward_root_submitter_private_key,
    )
