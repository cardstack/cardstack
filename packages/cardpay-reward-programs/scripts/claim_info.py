#!/usr/bin/env python3

import json
import os

import pandas as pd
import requests
from cardpay_reward_programs.config import config
from dotenv import load_dotenv
from eth_abi import decode_abi
from hexbytes import HexBytes
from web3 import Web3

load_dotenv()
for expected_env in ["ENVIRONMENT"]:
    if expected_env not in os.environ:
        raise ValueError(f"Missing environment variable {expected_env}")
env = os.getenv("ENVIRONMENT")

subgraph_url = config[env]["subgraph_url"]
card_token = config[env]["tokens"]["card"]
reward_program_id = config[env]["reward_program"]
program_payment_cycle = 21294676


def decode_leaf(leaf):
    return decode_abi(
        ["address", "uint256", "uint256", "uint256", "uint256", "address", "bytes"],
        leaf,
    )


def decode_transfer_data(transfer_data):
    return decode_abi(["address", "uint256"], transfer_data)


def query(skip: int):
    return """
    {
    rewardeeClaims(
        skip: %s,
        orderBy: id,
        where:{
            token: "%s",
            rewardProgram: "%s"
    }) {
       amount
       leaf
    }
    }
    """ % (
        skip,
        card_token,
        reward_program_id,
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
        return data["rewardeeClaims"]


def get_claim_info():
    """
    Get info on ewardee claims for a particular payment cycle
    """
    paginate_size = 100

    res = []
    total = 0

    i = 0
    while c := call(i * paginate_size):
        for o in c:
            (_, payment_cycle, _, _, _, _, transfer_data) = decode_leaf(
                HexBytes(o["leaf"])
            )
            if program_payment_cycle == payment_cycle:
                total = total + int(o["amount"])
                res.append(o)
        i = i + 1

    total_in_eth = Web3.fromWei(total, "ether")
    print(f"Number of reward claims: {len(res)}")
    print(f"Total value claimed: {total_in_eth}")


if __name__ == "__main__":
    get_claim_info()
