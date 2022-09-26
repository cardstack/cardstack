import json
import re
from typing import Any, Callable, Dict, TypedDict

import boto3
import pandas as pd
import requests
import typer
from cardpay_reward_programs.config import config
from scripts.utils import Environment


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
    env: str, skip: int, query: Callable[[int, int, Dict[str, Any]], SubgraphQuery]
):
    print(f"Skipping {skip}")
    subgraph_url = config[env]["subgraph_url"]
    subgraph_query = query(skip)
    r = requests.post(
        subgraph_url,
        json={"query": subgraph_query["query"]},
    )
    if r.ok:
        json_data = json.loads(r.text)
        data = json_data["data"]
        return data[subgraph_query["name"]]


def get_all_merkle_root_submissions(env: Environment):
    paginate_size = 100
    res = []

    i = 0
    while c := query_subgraph(env, i * paginate_size, merkle_root_submissions_query):
        if len(c) == 0:
            break
        transformed_c = list(
            map(
                lambda o: {
                    "reward_program_id": o["rewardProgram"]["id"],
                    "payment_cycle": o["paymentCycle"],
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


def check_missing_roots(
    env: Environment = Environment.staging,
):
    """
    All s3 files that exist should be written on the blockchain.
    If it hasn't, the root is considered missing
    """
    s3 = boto3.resource("s3")
    rewards_bucket = config[env]["rewards_bucket"][5:]
    bucket = s3.Bucket(rewards_bucket)
    roots = []
    for o in bucket.objects.all():
        reward_program_id = safe_regex_group_search(
            r"rewardProgramID=([^/]*)", str(o.key), 1
        )
        payment_cycle = safe_regex_group_search(r"paymentCycle=([^/]*)", str(o.key), 1)
        if o.key.endswith("results.parquet"):
            roots.append(
                {"reward_program_id": reward_program_id, "payment_cycle": payment_cycle}
            )
    col_keys = ["reward_program_id", "payment_cycle"]
    subgraph_df = get_all_merkle_root_submissions(env)
    s3_df = pd.DataFrame(roots)
    left_join_df = s3_df.merge(
        subgraph_df, how="left", on=col_keys, indicator=True
    ).copy()
    missing_roots_df = left_join_df[left_join_df["_merge"] == "left_only"].drop(
        "_merge", axis=1
    )
    print(f"Total of {len(missing_roots_df)} out of {len(s3_df)} roots are missing ")
    missing_roots_df.to_csv(f"{env}_missng_roots.csv", index=False)


if __name__ == "__main__":
    typer.run(check_missing_roots)
