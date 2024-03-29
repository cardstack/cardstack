from sqlalchemy import Column, DateTime, Integer, PickleType, String, UniqueConstraint
from sqlalchemy.ext.mutable import MutableList

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
    explanationId = Column(String, nullable=True)
    explanationData = Column(PickleType, default={})


class Root(Base):
    __tablename__ = "roots"
    id = Column(Integer, primary_key=True, index=True)
    rewardProgramId = Column(String)
    rootHash = Column(String)
    paymentCycle = Column(Integer)
    blockNumber = Column(Integer)
    timestamp = Column(DateTime)
    __table_args__ = (
        UniqueConstraint(
            "rewardProgramId", "paymentCycle", name="rewardProgramId_paymentCycle"
        ),
    )
