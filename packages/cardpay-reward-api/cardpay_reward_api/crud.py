#!/usr/bin/env python3

import json
from typing import Optional

import boto3
from sqlalchemy.orm import Session

from . import models, schemas

s3 = boto3.client("s3")


def get_proofs(proof_filter, param):
    return []


def s3_select(proof_filter):
    query = "select * from s3object s"
    proof_filter = {k: v for k, v in proof_filter.dict().items() if v is not None}
    query = "select * from s3object s"
    print(proof_filter)
    print(dir(proof_filter))
    bucket = "tally-staging-reward-programs"
    reward_program_id = proof_filter["rewardProgramID"]
    payment_cycle = 25650728
    key = f"rewardProgramID={reward_program_id}/paymentCycle={payment_cycle}"
    r = s3.select_object_content(
        Bucket=bucket,
        Key=key,
        ExpressionType="SQL",
        Expression=query,
        InputSerialization={"Parquet": {}},
        OutputSerialization={
            "JSON": {}
        },  # csv delivers error altho this is the preferred option
    )
    proofs = []
    pre = None
    for event in r["Payload"]:
        if "Records" in event:
            msg = event["Records"]["Payload"].decode("utf-8")
            msg_ls = msg.split("\n")  # json delimited with split by default
            for s in msg_ls:
                try:
                    if pre is not None:
                        o = json.loads(pre + s)
                        pre = None
                    else:
                        o = json.loads(s)
                    proofs.append(o)
                except Exception as e:
                    if "Unterminated string starting at:" in str(e):
                        pre = s  # pre is the first half of the split object
                    else:
                        raise Exception(e)
        elif "Stats" in event:
            statsDetails = event["Stats"]["Details"]
            print("Stats details bytesScanned: ")
            print(statsDetails["BytesScanned"])
            print("Stats details bytesProcessed: ")
            print(statsDetails["BytesProcessed"])
        return proofs
