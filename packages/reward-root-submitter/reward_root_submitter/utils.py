import logging
import re
from typing import Any, Callable, Dict, TypedDict

import pandas as pd
import requests
from cloudpathlib import AnyPath
from web3 import Web3

from .config import Config

DEFAULT_SUBGRAPH_PAGINATE_SIZE = 100


def safe_regex_group_search(regex, string, group):
    """
    Returns None in the case of a missing group
    """
    match = re.search(regex, string)
    if match:
        return match.group(group)
    else:
        return None


class SubgraphQuery(TypedDict):
    name: str
    query: str


def merkle_root_submissions_query(
    skip: int, blockNumber_gt=0, **filters
) -> SubgraphQuery:
    query = """{{
        merkleRootSubmissions(
            skip: {skip},
            orderBy: blockNumber,
            orderDirection: asc,
            where: {{ blockNumber_gt: {blockNumber_gt} }}
        )
        {{
            rewardProgram {{
                id
            }}
            paymentCycle
        }}
    }}""".format(
        **{"skip": skip, "blockNumber_gt": blockNumber_gt, **filters}
    )
    return {"name": "merkleRootSubmissions", "query": query}


def query_subgraph(
    config: Config,
    skip: int,
    blockNumber_gt: int,
    query: Callable[[int, int, Dict[str, Any]], SubgraphQuery],
):
    logging.info(f"Skipping {skip}")
    subgraph_url = config.subgraph_url
    subgraph_query = query(skip, blockNumber_gt)
    r = requests.post(
        subgraph_url,
        json={"query": subgraph_query["query"]},
    )
    if r.ok:
        json_data = r.json()
        data = json_data["data"]
        return data[subgraph_query["name"]]


def get_roots_subgraph(config: Config, min_scan_block=0):
    paginate_size = 100
    res = []

    i = 0
    while c := query_subgraph(
        config, i * paginate_size, min_scan_block, merkle_root_submissions_query
    ):
        if len(c) == 0:
            break
        res.extend(
            {
                "reward_program_id": root_submission["rewardProgram"]["id"],
                "payment_cycle": int(root_submission["paymentCycle"]),
            }
            for root_submission in c
        )
        i = i + 1
    df = pd.DataFrame(res)
    return df


def _get_potential_reward_output_locations(reward_program_bucket: AnyPath):
    """
    This is a generator that yields the locations
    of reward programs _if_ all results are well formed.
    NOTE: Please do not use .glob(). It is too slow
    """
    for reward_program_folder in reward_program_bucket.iterdir():
        for payment_cycle_folder in reward_program_folder.iterdir():
            yield payment_cycle_folder / "results.parquet"


def get_all_reward_outputs(reward_program_bucket: AnyPath, min_scan_block: int = 0):
    # This does not need to be initialised with an address
    # we just need the utility functions attached
    web3 = Web3()
    for result_file in _get_potential_reward_output_locations(reward_program_bucket):
        reward_program_id = safe_regex_group_search(
            r"rewardProgramID=([^/]*)", str(result_file), 1
        )
        payment_cycle = safe_regex_group_search(
            r"paymentCycle=(\d*)", str(result_file), 1
        )
        if int(payment_cycle) >= min_scan_block:
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


def get_roots_s3(config: Config, min_scan_block=0):

    outputs = get_all_reward_outputs(
        AnyPath(config.reward_program_output), min_scan_block
    )
    roots = []
    for output in outputs:
        roots.append(output)

    return pd.DataFrame(roots).drop_duplicates(
        subset=["reward_program_id", "payment_cycle"]
    )
