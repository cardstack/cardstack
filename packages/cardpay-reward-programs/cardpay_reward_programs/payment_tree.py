#!/usr/bin/env python3

import itertools
from collections import defaultdict
from copy import deepcopy
from typing import List, TypedDict

import pyarrow as pa
import sha3
from eth_abi import encode_abi
from eth_typing import ChecksumAddress
from eth_utils import add_0x_prefix
from merklelib import MerkleTree, beautify


class Payment(TypedDict):
    rewardProgramID: ChecksumAddress
    payee: ChecksumAddress
    paymentCycle: int
    validFrom: int
    validTo: int
    token: ChecksumAddress
    amount: int  # python should auto-detect big numbers


def group_by(data_array, callback):
    # remember: itertools.groupby requires that keys are sorted; it only groups common keys which are next to each other
    sorted_data = sorted(data_array, key=callback)
    return itertools.groupby(sorted_data, callback)


class PaymentTree:
    def __init__(self, payment_list: List[Payment]) -> None:
        self.payment_nodes = payment_list
        self.data = list(map(self.encode_payment, self.payment_nodes))
        self.tree = MerkleTree(self.data, hashfunc)

    @staticmethod
    def encode_payment(payment: Payment) -> bytes:
        rewardProgramID: ChecksumAddress = payment["rewardProgramID"]
        paymentCycle: int = payment["paymentCycle"]
        validFrom: int = payment["validFrom"]
        validTo: int = payment["validTo"]
        tokenType: int = 1
        payee: ChecksumAddress = payment["payee"]
        token: ChecksumAddress = payment["token"]
        amount: int = payment["amount"]
        transferData: bytes = encode_abi(["address", "uint256"], [token, amount])

        return encode_abi(
            ["address", "uint256", "uint256", "uint256", "uint256", "address", "bytes"],
            [
                rewardProgramID,
                paymentCycle,
                validFrom,
                validTo,
                tokenType,
                payee,
                transferData,
            ],
        )

    def get_hex_root(self):
        return add_0x_prefix(self.tree.merkle_root)

    def get_hex_proof(self, leaf):
        return self.tree.get_proof(leaf).hex_nodes

    def print_tree_map(self):
        return beautify(self.tree)

    def verify_inclusion(self, leaf):
        return self.tree.verify_leaf_inclusion(leaf, self.tree.get_proof(leaf))

    def as_arrow(self):
        # Auto-detection of schemas risks invalid columns, so define manually
        schema = pa.schema(
            [
                pa.field("rewardProgramID", pa.string()),
                pa.field("paymentCycle", pa.int32()),
                pa.field("validFrom", pa.int32()),
                pa.field("validTo", pa.int32()),
                pa.field("tokenType", pa.int32()),
                pa.field("payee", pa.string()),
                pa.field("root", pa.string()),
                pa.field("leaf", pa.string()),
                pa.field("proof", pa.list_(pa.string())),
            ]
        )
        # Arrow tables are constructed by column
        # so we need to flip the data

        columns = defaultdict(list)
        if len(self.data) > 0:
            root = self.get_hex_root()
            extract_fields = ["rewardProgramID", "paymentCycle", "validFrom", "validTo", "payee"]
            for payment, leaf in zip(self.payment_nodes, self.data):
                for field in extract_fields:
                    columns[field].append(payment[field])
                columns["tokenType"].append(1)
                columns["root"].append(root)
                columns["leaf"].append(leaf.hex())
                columns["proof"].append(self.get_hex_proof(leaf))
        return pa.table(data=columns, schema=schema)


def hashfunc(value_in_bytes):
    return sha3.keccak_256(value_in_bytes).hexdigest()
