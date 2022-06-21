#!/usr/bin/env python3

import pytest
from cardpay_reward_api.database import Base
from cardpay_reward_api.main import app, get_db
from cardpay_reward_api.models import Proof
from fastapi.testclient import TestClient

from .config import engine, override_get_db, settings
from .mocks import reward_programs, roots_for_program
from .utils import (check_duplicates_for_proofs, check_duplicates_for_roots,
                    validate_proof_response_fields)

# this overrides the get_db function yielding a different session with different engine
# it is only needed when using dependencies in fastapi
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(scope="module")
def monkeymodule():
    """
    We need to use monkeypatch when patching a fixture
    But the issue is that, we will always receive a ScopeMismatch error
    when wanting the fixture to run once in a specific scope (in this case a module)
    https://stackoverflow.com/questions/53963822/python-monkeypatch-setattr-with-pytest-fixture-at-module-scope
    """
    from _pytest.monkeypatch import MonkeyPatch

    mpatch = MonkeyPatch()
    yield mpatch
    mpatch.undo()


@pytest.fixture(scope="module")
def mock_db(monkeymodule):
    # setup
    Base.metadata.create_all(bind=engine)
    db = next(override_get_db())
    yield db
    # teardown
    # https://stackoverflow.com/questions/67255653/how-to-set-up-and-tear-down-a-database-between-tests-in-fastapi
    Base.metadata.drop_all(bind=engine)


mock_proofs = [
    {
        "rootHash": "0x9f880d8e63c4dca5f33fce867a36e988afbf41ed9f1ab0e08387b1bc76921173",
        "paymentCycle": 26777325,
        "tokenAddress": "0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee",
        "payee": "0x159ADe032073d930E85f95AbBAB9995110c43C71",
        "proofArray": [
            "0xde36d63c3f3e82f3c58d8fbe26245ff24723f946058c110a1efdbf5475a4858e",
            "0x987eceb89425ee4bdc5d93770077f4e00715c55d110dd38a478dcf8de5d83b64",
            "0x0e905a4e99500108b989ac26b65143fc587c8278d4bd144dce9b4c53e0cee020",
            "0xc56a1d3047ef48c96abccedcfd1f41c566e84cd3ecbf0d836bbbe4c8c4769e88",
            "0x1bbbf0c6c6b533e151354625cf45576ce9532c7c2dcc66bebbf11e7edcc596f6",
        ],
        "rewardProgramId": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA",
        "amount": "10660000000000000000",
        "leaf": "0x0000000000000000000000005e4e148baae93424b969a0ea67ff54c315248bba00000000000000000000000000000000000000000000000000000000019896ed00000000000000000000000000000000000000000000000000000000019896ed0000000000000000000000000000000000000000000000000000000001a4746d0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000159ade032073d930e85f95abbab9995110c43c7100000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b236ca8dbab0644ffcd32518ebf4924ba866f7ee00000000000000000000000000000000000000000000000093efed8559aa0000",
        "validFrom": 26777325,
        "validTo": 27554925,
    },
    {
        "rootHash": "0x3b4096bd5a350c9469089b781e7ee0c7e57a08749b267c770604a14e80f835b2",
        "paymentCycle": 26777601,
        "tokenAddress": "0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee",
        "payee": "0x159ADe032073d930E85f95AbBAB9995110c43C71",
        "proofArray": [
            "0x19ffcb37a60b415b6a1a17d3aa0078de68fa0307e85b1a55651b91a9baa988cb",
            "0xdbfe0c676016f8f2f41f50bf6e129831a5e9edecdf26df15ced5fb6018c32a33",
            "0xafb10c1344c926150a85f41fba5dde4ebbf2d0f66e652719f10671a312245ef0",
            "0xd76647f34bfbb102037da36dba616d85c8e5f3b2098f9350e37a3bd4a7397f09",
            "0x613a780b2fd3c75acc571892f574bb743e5b52be8dc329db6d16bac5228e0f86",
        ],
        "rewardProgramId": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA",
        "amount": "10880000000000000000",
        "leaf": "0x0000000000000000000000005e4e148baae93424b969a0ea67ff54c315248bba000000000000000000000000000000000000000000000000000000000198980100000000000000000000000000000000000000000000000000000000019898010000000000000000000000000000000000000000000000000000000001a475810000000000000000000000000000000000000000000000000000000000000001000000000000000000000000159ade032073d930e85f95abbab9995110c43c7100000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b236ca8dbab0644ffcd32518ebf4924ba866f7ee00000000000000000000000000000000000000000000000096fd865af4400000",
        "validFrom": 26777601,
        "validTo": 27555201,
    },
    {
        "rootHash": "0xee9c501af460fa65d059d64f415969cfa954413158af14c9e6a6e2f4e97d7d45",
        "paymentCycle": 26778053,
        "tokenAddress": "0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee",
        "payee": "0x159ADe032073d930E85f95AbBAB9995110c43C71",
        "proofArray": [],
        "rewardProgramId": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA",
        "amount": "10110000000000000000",
        "leaf": "0x0000000000000000000000005e4e148baae93424b969a0ea67ff54c315248bba00000000000000000000000000000000000000000000000000000000019899c500000000000000000000000000000000000000000000000000000000019899c50000000000000000000000000000000000000000000000000000000001a477450000000000000000000000000000000000000000000000000000000000000001000000000000000000000000159ade032073d930e85f95abbab9995110c43c7100000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b236ca8dbab0644ffcd32518ebf4924ba866f7ee0000000000000000000000000000000000000000000000008c4def6f57330000",
        "validFrom": 26778053,
        "validTo": 27555653,
    },
]


def test_read_proofs(mock_db):
    with mock_db.begin():
        proofs = []
        for o in mock_proofs:
            proofs.append(
                Proof(
                    rootHash=o["rootHash"],
                    paymentCycle=o["paymentCycle"],
                    tokenAddress=o["tokenAddress"],
                    payee=o["payee"],
                    proofArray=o["proofArray"],
                    rewardProgramId=o["rewardProgramId"],
                    amount=o["amount"],
                    leaf=o["leaf"],
                    validFrom=o["validFrom"],
                    validTo=o["validTo"],
                )
            )
        mock_db.bulk_save_objects(proofs)
    response = client.get("/merkle-proofs/0x159ADe032073d930E85f95AbBAB9995110c43C71")
    res = response.json()
    assert len(res) == 3
    validate_proof_response_fields(res)
    check_duplicates_for_proofs(res)
