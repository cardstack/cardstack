import json
from collections import defaultdict
from typing import List, TypedDict, Union

import pyarrow as pa
import sha3
from eth_abi import decode_abi, encode_abi
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


def encode_payment(payment: Payment) -> bytes:
    rewardProgramID: ChecksumAddress = payment["rewardProgramID"]
    paymentCycle: int = payment["paymentCycle"]
    validFrom: int = payment["validFrom"]
    validTo: int = payment["validTo"]
    tokenType: int = 1
    payee: ChecksumAddress = payment["payee"]
    token: ChecksumAddress = payment["token"]
    amount: int = int(payment["amount"])
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


def decode_payment(encoded_payment: Union[bytes, str]) -> Payment:
    if type(encoded_payment) == str:
        encoded_payment = bytes.fromhex(encoded_payment)
    (
        rewardProgramID,
        paymentCycle,
        validFrom,
        validTo,
        tokenType,
        payee,
        transferData,
    ) = decode_abi(
        ["address", "uint256", "uint256", "uint256", "uint256", "address", "bytes"],
        encoded_payment,
    )
    (token, amount) = decode_abi(["address", "uint256"], transferData)
    return Payment(
        {
            "rewardProgramID": rewardProgramID,
            "paymentCycle": paymentCycle,
            "validFrom": validFrom,
            "validTo": validTo,
            "tokenType": tokenType,
            "payee": payee,
            "token": token,
            "amount": amount,
        }
    )


class PaymentTree:
    def __init__(self, payment_list: List[Payment], parameters={}) -> None:
        self.payment_nodes = payment_list
        self.parameters = parameters
        self.data = list(map(encode_payment, self.payment_nodes))

        self.tree = MerkleTree(self.data, hashfunc)
        if len(self.data) != len(set(self.data)):
            raise Exception(
                "There are duplicate leafs. Check if you are rewarding the same address twice."
            )

    def get_hex_root(self):
        return add_0x_prefix(self.tree.merkle_root)

    def get_hex_proof(self, leaf):
        return self.tree.get_proof(leaf).hex_nodes

    def print_tree_map(self):
        return beautify(self.tree)

    def verify_inclusion(self, leaf):
        return self.tree.verify_leaf_inclusion(leaf, self.tree.get_proof(leaf))

    def as_arrow(self, explanation_id, explanation_data_arr):
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
                pa.field("explanation_id", pa.string()),
                pa.field("explanation_data", pa.map_(pa.string(), pa.string())),
            ],
            metadata={
                "parameters": json.dumps(self.parameters, default=lambda o: o.__dict__)
            },
        )
        # Arrow tables are constructed by column
        # so we need to flip the data

        columns = defaultdict(list)
        if len(self.data) > 0:
            root = self.get_hex_root()
            extract_fields = [
                "rewardProgramID",
                "paymentCycle",
                "validFrom",
                "validTo",
                "payee",
            ]
            for i, (payment, leaf) in enumerate(zip(self.payment_nodes, self.data)):
                for field in extract_fields:
                    columns[field].append(payment[field])
                columns["tokenType"].append(1)
                columns["root"].append(root)
                columns["leaf"].append(leaf.hex())
                columns["proof"].append(self.get_hex_proof(leaf))
                columns["explanation_id"].append(explanation_id)
                o = explanation_data_arr[i] if i < len(explanation_data_arr) else {}
                columns["explanation_data"].append([(k, str(v)) for k, v in o.items()])
        return pa.table(data=columns, schema=schema)


def hashfunc(value_in_bytes):
    return sha3.keccak_256(value_in_bytes).hexdigest()
