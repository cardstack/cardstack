#!/usr/bin/env python3

import json
import os

import pandas as pd
import requests
import typer
from cardpay_reward_programs.config import config
from dotenv import load_dotenv
from scripts.utils import Environment

token_balance_in_wei = 50_000_000_000_000_000  # 0.05 dai


def query(env: str, skip: int):
    token_address = config[env]["tokens"]["dai"]
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


def call(env: str, skip: int):
    print(f"Skipping {skip}")
    subgraph_url = config[env]["subgraph_url"]
    r = requests.post(
        subgraph_url,
        json={"query": query(env, skip)},
    )
    if r.ok:
        json_data = json.loads(r.text)
        data = json_data["data"]
        return data["prepaidCards"]


def get_prepaid_cards_less_gas(
    env: Environment = Environment.staging,
    csv: bool = typer.Argument(default=False, help="output csv file"),
):
    env = env.value
    paginate_size = 100
    res = []

    i = 0
    while c := call(env, i * paginate_size):
        if len(c) == 0:
            break
        res = res + c
        i = i + 1
    print(f"Number of prepaid cards with too little gas: {len(res)}")
    df = pd.DataFrame(res)

    if csv:
        df.to_csv("prepaid_card_less_gas.csv", index=False)


if __name__ == "__main__":
    typer.run(get_prepaid_cards_less_gas)
