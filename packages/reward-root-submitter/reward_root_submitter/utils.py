import json
import logging
import re
from typing import Any, Callable, Dict, TypedDict

import pandas as pd
import requests
from cloudpathlib import AnyPath
from web3 import Web3

from .config import Config

DEFAULT_MAX_PAST_BLOCKS = 34560  # 2 days (1 block every 5s)
DEFAULT_SUBGRAPH_PAGINATE_SIZE = 100


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
    print(f"Skipping {skip}")
    subgraph_url = config.subgraph_url
    subgraph_query = query(skip, blockNumber_gt)
    r = requests.post(
        subgraph_url,
        json={"query": subgraph_query["query"]},
    )
    if r.ok:
        json_data = json.loads(r.text)
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
        transformed_c = list(
            map(
                lambda o: {
                    "reward_program_id": o["rewardProgram"]["id"],
                    "payment_cycle": int(o["paymentCycle"]),
                },
                c,
            )
        )

        res = res + transformed_c
        i = i + 1
    df = pd.DataFrame(res)
    return df


def safe_regex_group_search(regex, string, group):
    """
    Returns None in the case of a missing group
    """
    match = re.search(regex, string)
    if match:
        return match.group(group)
    else:
        return None


def _get_potential_reward_output_locations(reward_program_bucket: AnyPath):
    """
    This is a generator that yields the locations
    of reward programs _if_ all results are well formed.
    """
    for i in reward_program_bucket.glob("rewardProgramID=*/paymentCycle=*/*.parquet"):
        yield i


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
        if int(payment_cycle) < min_scan_block:
            continue
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

    return (
        pd.DataFrame(roots)
        .drop("file", axis=1)
        .drop_duplicates(subset=["reward_program_id", "payment_cycle"])
    )


def get_all_unsubmitted_roots(config: Config):
    evm_node = config.evm_full_node_url
    w3 = Web3(Web3.HTTPProvider(evm_node))
    current_block = w3.eth.get_block("latest")["number"]
    min_scan_block = current_block - DEFAULT_MAX_PAST_BLOCKS

    s3_df = get_roots_s3(config, min_scan_block)
    subgraph_df = get_roots_subgraph(config, min_scan_block)
    left_exclude_join_df = s3_df.merge(
        subgraph_df,
        how="left",
        on=["reward_program_id", "payment_cycle"],
        indicator=True,
    ).copy()
    missing_roots_df = left_exclude_join_df[
        left_exclude_join_df["_merge"] == "left_only"
    ].drop("_merge", axis=1)
    logging.info(
        f"Total of {len(missing_roots_df)} out of {len(s3_df)} roots are missing "
    )
