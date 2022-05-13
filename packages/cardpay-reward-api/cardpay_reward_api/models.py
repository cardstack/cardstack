#!/usr/bin/env python3

from sqlalchemy import (Boolean, Column, ForeignKey, Integer, PickleType,
                        String, Time)
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import relationship

from .database import Base


class Proof(Base):
    __tablename__ = "proofs"
    id = Column(Integer, primary_key=True, index=True)
    rootHash = Column(String)
    paymentCycle = Column(Integer)
    tokenAddress = Column(String)
    payee = Column(String)
    proofArray = Column(MutableList.as_mutable(PickleType), default=[])
    rewardProgramId = Column(String)
    amount = Column(String)
    leaf = Column(String, unique=True)
    validFrom = Column(Integer)
    validTo = Column(Integer)


class Root(Base):
    __tablename__ = "roots"
    id = Column(Integer, primary_key=True, index=True)
    rewardProgramId = Column(String)
    rootHash = Column(String, unique=True)
    paymentCycle = Column(Integer)
    blockNumber = Column(Integer)
    timestamp = Column(Time)
