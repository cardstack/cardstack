# BELOW ALL COPIED FROM ROOT SUBMITTER
import re

from cloudpathlib import AnyPath
from web3 import Web3


def safe_regex_group_search(regex, string, group):
    """
    Returns None in the case of a missing group
    """
    match = re.search(regex, string)
    if match:
        return match.group(group)
    else:
        return None


def _get_potential_reward_output_locations(root: AnyPath):
    """
    This is a generator that yields the locations
    of reward programs _if_ all results are well formed.
    """
    for reward_program_folder in root.iterdir():
        for payment_cycle_folder in reward_program_folder.iterdir():
            yield payment_cycle_folder / "results.parquet"


def get_all_reward_outputs(root: AnyPath):
    # This does not need to be initialised with an address
    # we just need the utility functions attached
    web3 = Web3()
    for result_file in _get_potential_reward_output_locations(root):
        reward_program_id = safe_regex_group_search(
            r"rewardProgramID=([^/]*)", str(result_file), 1
        )
        payment_cycle = safe_regex_group_search(
            r"paymentCycle=(\d*)", str(result_file), 1
        )
        if (
            web3.isChecksumAddress(reward_program_id)
            and result_file.is_file()  # checks existence & is not a folder
            and (payment_cycle or "").isdigit()
        ):
            yield {
                "file": result_file,
                "reward_program_id": reward_program_id,
                "payment_cycle": int(payment_cycle),
            }
