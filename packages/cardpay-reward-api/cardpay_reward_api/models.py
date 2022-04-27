#!/usr/bin/env python3

from sqlalchemy import (Boolean, Column, ForeignKey, Integer, PickleType,
                        String, Time)
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import relationship

from .database import Base


class Proof(Base):
    __tablename__ = "proofs"
    id = Column(Integer, primary_key=True, index=True)
    reward_program_id = Column(String)
    root_hash = Column(String)
    # block_number = Column(Integer)
    leaf = Column(String, unique=True)
    # proof_array = Column(Array(String))
    payment_cycle = Column(Integer)
    payee = Column(String)
    token = Column(String)
    proof_array = Column(MutableList.as_mutable(PickleType), default=[])
    # timestamp = Column(Time)


class Root(Base):
    __tablename__ = "roots"
    id = Column(Integer, primary_key=True, index=True)
    reward_program_id = Column(String)
    root_hash = Column(String, unique=True)
    payment_cycle = Column(Integer)
    block_number = Column(Integer)
    timestamp = Column(Time)

    # def __repr__(self):
    #     return "hi"
