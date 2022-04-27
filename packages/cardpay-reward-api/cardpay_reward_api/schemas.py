#!/usr/bin/env python3

from typing import List, Optional

from pydantic import BaseModel


class ProofPart(BaseModel):
    item: str


class Proof(BaseModel):
    rewardProgramID: str
    root: str
    paymentCycle: int
    validFrom: int
    validTo: int
    tokenType: int
    payee: str
    leaf: str
    proof: List[ProofPart]


class ProofFilter(BaseModel):
    rewardProgramID: Optional[str]
    token: Optional[str]
    payee: str
