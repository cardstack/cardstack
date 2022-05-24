#!/usr/bin/env python3

import json
import os

import pandas as pd
import requests
from cardpay_reward_programs.config import config
from dotenv import load_dotenv

load_dotenv()
for expected_env in ["ENVIRONMENT"]:
    if expected_env not in os.environ:
        raise ValueError(f"Missing environment variable {expected_env}")
env = os.getenv("ENVIRONMENT")


subgraph_url = config[env]["subgraph_url"]
token_address = config[env]["tokens"]["dai"]
token_balance_in_wei = 50_000_000_000_000_000  # 0.05 dai


def query(skip: int):
    return """
    {
    prepaidCards(
        skip: %s,
        orderBy: id,
        where:{
        issuingTokenBalance_lt: %s,
        issuingToken: "%s"
    }) {
        id
        faceValue
    }
    }
    """ % (
        skip,
        token_balance_in_wei,
        token_address,
    )


def call(skip: int):
    print(f"Skipping {skip}")
    r = requests.post(
        subgraph_url,
        json={"query": query(skip)},
    )
    if r.ok:
        json_data = json.loads(r.text)
        data = json_data["data"]
        return data["prepaidCards"]


def get_prepaid_cards_less_gas():
    paginate_size = 100
    res = []

    i = 0
    while c := call(i * paginate_size):
        if len(c) == 0:
            break
        res = res + c
        i = i + 1
    print(f"Number of prepaid cards with too little gas: {len(res)}")
    df = pd.DataFrame(res)
    df.to_csv("prepaid_card_less_gas.csv", index=False)


if __name__ == "__main__":
    get_prepaid_cards_less_gas()
