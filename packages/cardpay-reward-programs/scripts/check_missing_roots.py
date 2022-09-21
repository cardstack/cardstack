import json
import re

import boto3
import pandas as pd
import requests
import typer
from cardpay_reward_programs.config import config
from scripts.utils import Environment


def query(skip: int):
    return """
    {
        merkleRootSubmissions(
            skip: %s,
            orderBy: id,
        )
        {
            rewardProgram {
                id
            }
            paymentCycle
        }
    }""" % (
        skip
    )


def call(env: str, skip: int):
    print(f"Skipping {skip}")
    subgraph_url = config[env]["subgraph_url"]
    r = requests.post(
        subgraph_url,
        json={"query": query(skip)},
    )
    if r.ok:
        json_data = json.loads(r.text)
        data = json_data["data"]
        return data["merkleRootSubmissions"]


def transform(subgraph_o):
    return {
        "reward_program_id": subgraph_o["rewardProgram"]["id"],
        "payment_cycle": subgraph_o["paymentCycle"],
    }


def get_all_merkle_root_submissions(env: Environment):
    paginate_size = 100
    res = []

    i = 0
    while c := call(env, i * paginate_size):
        if len(c) == 0:
            break
        transformed_c = list(map(transform, c))

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


def query_subgraph(subgraph_url, query):
    try:
        r = requests.post(
            subgraph_url,
            json={"query": query},
        )
        if r.ok:
            json_data = r.json()
            return json_data["data"]
        else:
            raise (r.raise_for_status())
    except Exception as e:
        raise (e)


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
        roots.append(
            {"reward_program_id": reward_program_id, "payment_cycle": payment_cycle}
        )
    col_keys = ["reward_program_id", "payment_cycle"]
    subgraph_df = get_all_merkle_root_submissions(env)
    s3_df = pd.DataFrame(roots).drop_duplicates(subset=col_keys)
    # have to drop duplicates because there are two files in each bucket. there is no great way to list directories in s3 because it doesn't support glob-like pattern
    # TODO: it would be nice to fix this because it is very error-prone -- https://stackoverflow.com/questions/35442383/filter-a-glob-like-regex-pattern-in-boto3
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
