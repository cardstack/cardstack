import json

import pytest
from cloudpathlib import AnyPath
from eth_utils import denoms
from hexbytes import HexBytes
from reward_root_submitter.config import Config
from reward_root_submitter.contracts import RewardPool
from reward_root_submitter.main import get_merkle_root_details
from web3 import EthereumTesterProvider, Web3


@pytest.fixture(autouse=True)
def no_gas_oracle(monkeypatch):
    """Remove remote call to oracle for all tests."""
    monkeypatch.setattr(RewardPool, "get_gas_price", lambda x: 1000000000)


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
    with open(f"tests/resources/abis/{contract_name}.json") as contract_file:
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
def reward_pool_address(w3, deploy_address, deploy_key):
    token_manager = create_and_initialise("token-manager", w3, deploy_address)
    version_manager = create_and_initialise("version-manager", w3, deploy_address)
    reward_pool = create_and_initialise("reward-pool", w3, deploy_address)

    action_dispatcher = create_and_initialise("action-dispatcher", w3, deploy_address)
    tx_hash = action_dispatcher.functions.addHandler(
        deploy_address, "not_used"
    ).transact({"from": deploy_address})
    w3.eth.wait_for_transaction_receipt(tx_hash, 180)

    reward_manager = create_and_initialise("reward-manager", w3, deploy_address)
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
    return reward_pool.address


@pytest.fixture
def config(deploy_address, deploy_key):
    return Config(
        environment="test",
        evm_full_node_url="test",
        reward_root_submitter_address=deploy_address,
        reward_root_submitter_private_key=deploy_key,
        reward_root_submitter_sentry_dsn="test",
        reward_program_output="tests/resources/reward_output/",
        subgraph_url="https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol",
    )


def get_details_from_test_file(reward_program_id, payment_cycle):
    return get_merkle_root_details(
        AnyPath(
            f"tests/resources/reward_output/rewardProgramID={reward_program_id}/paymentCycle={payment_cycle}/results.parquet"
        )
    )


def test_submit_root(w3, reward_pool_address, config):
    reward_pool_contract = RewardPool(w3)
    reward_pool_contract.setup_from_address(reward_pool_address)
    reward_pool_contract.submit_merkle_root(
        reward_programs()[0],
        12,
        HexBytes("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        config.reward_root_submitter_address,
        config.reward_root_submitter_private_key,
    )
    hw = reward_pool_contract.contract.caller.payeeRoots(reward_programs()[0], 12)
    assert hw == HexBytes(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )


def test_gets_FFF_root_for_empty_file():
    empty_file_program_id = "0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd"
    empty_file_cycle = 24098304
    details = get_details_from_test_file(empty_file_program_id, empty_file_cycle)
    assert details.merkle_root_hash == HexBytes(
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
    )
    assert details.payment_cycle == empty_file_cycle
    assert details.reward_program_id == empty_file_program_id


def test_can_get_root():
    reward_program = "0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd"
    payment_cycle = 24000000
    details = get_details_from_test_file(reward_program, payment_cycle)
    assert details.merkle_root_hash == HexBytes(
        "0xad76f200c39cc399e6bdbb260f7ad4add0847b6bdf4fd42abdd1472a0d53bdfb"
    )
    assert details.payment_cycle == payment_cycle


def test_validates_address():
    with pytest.raises(
        Exception, match=r".* does not have a valid checksummed address .*"
    ):
        reward_program = "0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd"
        payment_cycle = 24000000
        get_details_from_test_file(reward_program.lower(), payment_cycle)


def test_validates_payment_cycle_missing():
    with pytest.raises(Exception, match=r".* does not have a valid payment cycle.*"):
        reward_program = "0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd"
        payment_cycle = ""
        get_details_from_test_file(reward_program, payment_cycle)


def test_validates_payment_cycle_not_number():
    with pytest.raises(Exception, match=r".* does not have a valid payment cycle.*"):
        reward_program = "0xA2e8225dE0385ebC20B3C0160864f4e20a750cfd"
        payment_cycle = "hello"
        get_details_from_test_file(reward_program, payment_cycle)


def test_validates_path_matches_reward_program():
    with pytest.raises(
        Exception, match=r".* payment cycle in path and in the file do not match.*"
    ):
        get_merkle_root_details(
            AnyPath(
                "tests/resources/reward_output_with_mismatched_contents/rewardProgramID=0xBb2B1638a16268b4ACFB4B38fbB9D6081F876BA1/paymentCycle=1234/results.parquet"
            )
        )


def test_validates_cycle_matches_reward_program():
    with pytest.raises(
        Exception, match=r".* reward program ID in path and in the file do not match.*"
    ):
        get_merkle_root_details(
            AnyPath(
                "tests/resources/reward_output_with_mismatched_contents/rewardProgramID=0xBb2B1638a16268b4ACFB4B38fbB9D6081F876BA1/paymentCycle=24000000/results.parquet"
            )
        )
