import pytest
from reward_root_submitter.submitter import RootSubmitter
from reward_root_submitter.utils import get_all_reward_outputs, get_root_from_file
from eth_utils import denoms
from hexbytes import HexBytes
from cloudpathlib import AnyPath
from cloudpathlib.local.implementations.s3 import LocalS3Client


from web3 import EthereumTesterProvider, Web3

import json


@pytest.fixture(autouse=True)
def no_gas_oracle(monkeypatch):
    """Remove remote call to oracle for all tests."""
    monkeypatch.setattr(RootSubmitter, "get_gas_price", lambda x: 1000000000)


@pytest.fixture
def tester_provider():
    return EthereumTesterProvider()


@pytest.fixture
def eth_tester(tester_provider):
    return tester_provider.ethereum_tester


@pytest.fixture
def w3(tester_provider):
    return Web3(tester_provider)


def create_and_initialise(contract_name, w3, deploy_address):
    with open(f"abis/{contract_name}.json") as contract_file:
        contract = json.load(contract_file)

    abi = contract["abi"]
    bytecode = contract["bytecode"]

    # Create our contract class.
    SmartContract = w3.eth.contract(abi=abi, bytecode=bytecode)
    # issue a transaction to deploy the contract.

    tx_hash = SmartContract.constructor().transact(
        {
            "from": deploy_address,
        }
    )
    # wait for the transaction to be mined
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, 180)
    # instantiate and return an instance of our contract.
    deployed_contract = SmartContract(tx_receipt.contractAddress)
    tx_hash = deployed_contract.functions.initialize(deploy_address).transact(
        {"from": deploy_address}
    )
    w3.eth.wait_for_transaction_receipt(tx_hash, 180)
    return deployed_contract


@pytest.fixture
def deploy_key():
    return "0x58d23b55bc9cdce1f18c2500f40ff4ab7245df9a89505e9b1fa4851f623d241d"


def arbitrary_address():
    return HexBytes("0x7e57Ecc6BB183E26c17300DCaf7F10ae8E19e5C6")


def reward_programs():
    return [
        "0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd",
        "0xBb2B1638a16268b4ACFB4B38fbB9D6081F876BA1",
    ]


@pytest.fixture
def deploy_address(eth_tester, deploy_key):
    account = eth_tester.add_account(deploy_key)

    # Fund it
    eth_tester.send_transaction(
        {
            "from": eth_tester.get_accounts()[0],
            "to": account,
            "value": 1 * denoms.ether,
            "gas": 21000,
            "gas_price": 1000000000,
        }
    )
    return account


@pytest.fixture
def reward_pool(w3, deploy_address):
    token_manager = create_and_initialise("TokenManager", w3, deploy_address)
    version_manager = create_and_initialise("VersionManager", w3, deploy_address)
    reward_pool = create_and_initialise("RewardPool", w3, deploy_address)

    action_dispatcher = create_and_initialise("ActionDispatcher", w3, deploy_address)
    tx_hash = action_dispatcher.functions.addHandler(
        deploy_address, "not_used"
    ).transact({"from": deploy_address})
    w3.eth.wait_for_transaction_receipt(tx_hash, 180)

    reward_manager = create_and_initialise("RewardManager", w3, deploy_address)
    tx_hash = reward_manager.functions.setup(
        action_dispatcher.address,
        arbitrary_address(),
        arbitrary_address(),
        arbitrary_address(),
        1,
        [],
        arbitrary_address(),
        arbitrary_address(),
        version_manager.address,
    ).transact({"from": deploy_address})
    w3.eth.wait_for_transaction_receipt(tx_hash, 180)

    for reward_program_id in reward_programs():
        tx_hash = reward_manager.functions.registerRewardProgram(
            deploy_address, reward_program_id
        ).transact(
            {
                "from": deploy_address,
            }
        )
        w3.eth.wait_for_transaction_receipt(tx_hash, 180)
    tx_hash = reward_pool.functions.setup(
        deploy_address,
        reward_manager.address,
        token_manager.address,
        version_manager.address,
    ).transact({"from": deploy_address})
    w3.eth.wait_for_transaction_receipt(tx_hash, 180)
    return reward_pool


def test_submit_root(w3, reward_pool, deploy_address):

    tx_hash = reward_pool.functions.submitPayeeMerkleRoot(
        reward_programs()[0],
        12,
        HexBytes("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ).transact(
        {
            "from": deploy_address,
        }
    )
    w3.eth.wait_for_transaction_receipt(tx_hash, 180)

    hw = reward_pool.caller.payeeRoots(reward_programs()[0], 12)
    assert hw == HexBytes(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )


def test_submit_single_root(w3, reward_pool, deploy_address, deploy_key):
    submitter = RootSubmitter(
        w3,
        deploy_address,
        deploy_key,
        reward_pool.address,
        "tests/resources/reward_output",
    )
    submitter.submit_root(
        reward_programs()[0],
        12,
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
    hw = reward_pool.caller.payeeRoots(reward_programs()[0], 12)
    assert hw == HexBytes(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )


def test_submit_root_twice_is_safe(w3, reward_pool, deploy_address, deploy_key):
    submitter = RootSubmitter(
        w3,
        deploy_address,
        deploy_key,
        reward_pool.address,
        "tests/resources/reward_output",
    )
    submitter.submit_root(
        reward_programs()[0],
        12,
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
    hw = reward_pool.caller.payeeRoots(reward_programs()[0], 12)
    assert hw == HexBytes(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )
    # Now try to submit again
    submitter.submit_root(
        reward_programs()[0],
        12,
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
    hw = reward_pool.caller.payeeRoots(reward_programs()[0], 12)
    assert hw == HexBytes(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )


def test_submits_all_roots(w3, reward_pool, deploy_address, deploy_key):
    submitter = RootSubmitter(
        w3,
        deploy_address,
        deploy_key,
        reward_pool.address,
        "tests/resources/reward_output",
    )
    submitter.submit_all_roots()
    # There is no root for  "0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd" / 24098304
    for reward_program_id in reward_programs():
        for payment_cycle in [24000000, 24065536]:
            assert reward_pool.caller.payeeRoots(
                reward_program_id, payment_cycle
            ) != HexBytes(
                "0x0000000000000000000000000000000000000000000000000000000000000000"
            )


def test_can_find_all_payment_cycles():
    all_cycles = list(get_all_reward_outputs(AnyPath("tests/resources/reward_output/")))
    assert len(all_cycles) == 7
    assert {
        "file": AnyPath(
            "tests/resources/reward_output/rewardProgramID=0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd/paymentCycle=24000000/results.parquet"
        ),
        "reward_program_id": "0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd",
        "payment_cycle": 24000000,
    } in all_cycles


def test_can_find_all_payment_cycles_on_s3():
    s3_client = LocalS3Client(local_storage_dir="tests")
    all_cycles = list(
        get_all_reward_outputs(s3_client.S3Path("s3://resources/reward_output/"))
    )
    assert len(all_cycles) == 7
    assert {
        "file": s3_client.S3Path(
            "s3://resources/reward_output/rewardProgramID=0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd/paymentCycle=24000000/results.parquet"
        ),
        "reward_program_id": "0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd",
        "payment_cycle": 24000000,
    } in all_cycles


def test_can_get_root():
    file = AnyPath(
        "tests/resources/reward_output/rewardProgramID=0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd/paymentCycle=24000000/results.parquet"
    )
    root = get_root_from_file(file)
    assert root == HexBytes(
        "0xad76f200c39cc399e6bdbb260f7ad4add0847b6bdf4fd42abdd1472a0d53bdfb"
    )


def test_returns_none_when_file_empty():
    file = AnyPath(
        "tests/resources/reward_output/rewardProgramID=0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd/paymentCycle=24098304/results.parquet"
    )
    root = get_root_from_file(file)
    assert root is None
