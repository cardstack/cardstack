#!/usr/bin/env python3

from typing import List, Optional

from hexbytes import HexBytes
from pydantic import BaseModel, validator


class Proof(BaseModel):
    rootHash: str
    paymentCycle: int
    tokenAddress: str
    payee: str
    proofArray: List[str]
    rewardProgramId: str
    amount: str
    leaf: str
    validFrom: int
    validTo: int

    @validator("leaf", pre=True)
    def leaf_as_hex_string(cls, v):
        return HexBytes(v).hex()

    @validator("proofArray", pre=True, each_item=True)
    def proof_as_hex_string(cls, v):
        return HexBytes(v).hex()

    class Config:
        orm_mode = True


class ProofFilter(BaseModel):
    rewardProgramId: Optional[str]
    token: Optional[str]
    payee: str
