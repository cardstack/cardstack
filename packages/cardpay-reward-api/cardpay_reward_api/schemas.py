#!/usr/bin/env python3

from typing import List, Optional

from pydantic import BaseModel


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

    class Config:
        orm_mode = True


class ProofFilter(BaseModel):
    rewardProgramId: Optional[str]
    token: Optional[str]
    payee: str
