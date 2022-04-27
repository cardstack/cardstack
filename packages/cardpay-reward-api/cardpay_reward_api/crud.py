#!/usr/bin/env python3

import json
from typing import Optional

import boto3
from sqlalchemy.orm import Session

from . import models, schemas


def get_proofs(db: Session, proof_filter: schemas.ProofFilter, param):
    query = db.query(models.Proof)
    if proof_filter.payee is not None:
        query = query.filter(models.Proof.payee == proof_filter.payee)
    if proof_filter.rewardProgramId is not None:
        query = query.filter(
            models.Proof.rewardProgramId == proof_filter.rewardProgramId
        )
    if proof_filter.token is not None:
        query = query.filter(models.Proof.token == proof_filter.token)

    return query.offset(param["skip"]).limit(param["limit"]).all()
