import binascii
from tempfile import TemporaryDirectory
from unittest.mock import patch

import pyarrow as pa
import pytest
from cardpay_reward_programs.config import config
from cardpay_reward_programs.payment_tree import PaymentTree
from cardpay_reward_programs.rules import FlatPayment
from cardpay_reward_programs.utils import write_parquet_file
from cloudpathlib import AnyPath


@pytest.fixture
def rollover_rule(request):
    core_config = {
        "start_block": 100,
        "end_block": 1000,
        "payment_cycle_length": 100,
        "duration": 100,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
        "rollover": True,
    }
    user_config = {
        "reward_per_user": 1000,
        "token": config["staging"]["tokens"]["card"],
        "accounts": ["0x12AE66CDc592e10B60f9097a7b0D3C59fce29876"],
    }
    return FlatPayment(core_config, user_config)


@pytest.fixture
def rollover_rule_multiple(request):
    core_config = {
        "start_block": 100,
        "end_block": 1000,
        "payment_cycle_length": 100,
        "duration": 100,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
        "rollover": True,
    }
    user_config = {
        "reward_per_user": 1000,
        "token": config["staging"]["tokens"]["card"],
        "accounts": [
            "0x12AE66CDc592e10B60f9097a7b0D3C59fce29876",
            "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
            "0xc0ffee254729296a45a3885639AC7E10F9d54979",
        ],
    }
    return FlatPayment(core_config, user_config)


def claims_table(claims=[]):
    """Construct an arrow table for a set of claims

    Args:
        claims (List[Tuple[string, int]]): A list of claims as tuples of (leaf, block_number)
    """
    # We need to construct this in pyarrow to precisely specify the schema
    # otherwise somewhere down the line the pandas bytes will get converted
    # to a string like 'bytearray(b\'123\')'
    return pa.Table.from_pylist(
        [
            {"leaf": bytearray(binascii.unhexlify(leaf)), "_block_number": block}
            for leaf, block in claims
        ],
        schema=pa.schema([("leaf", pa.binary()), ("_block_number", pa.uint64())]),
    )


@patch("cardpay_reward_programs.utils.get_table_dataset")
def test_unclaimed_rewards_allow_rollover(get_table_dataset, rollover_rule):

    # Write
    with TemporaryDirectory() as tempdir:

        tempdir = AnyPath(tempdir)
        first_cycle_output = tempdir / "first_cycle_output"
        run_parameters = {
            "reward_program_id": "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72",
            "payment_cycle": 100,
        }
        payment_list = rollover_rule.get_payments(**run_parameters).to_dict("records")
        tree = PaymentTree(payment_list)
        table = tree.as_arrow()
        write_parquet_file(first_cycle_output, table)
        assert (first_cycle_output / "results.parquet").exists()

        # Create empty claims dataframe
        get_table_dataset.return_value = claims_table([])

        run_parameters = {
            "reward_program_id": "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72",
            "payment_cycle": 200,
            "previous_output": first_cycle_output / "results.parquet",
            "rewards_subgraph_location": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/",
        }
        payment_list = rollover_rule.get_payments(**run_parameters).to_dict("records")
        tree = PaymentTree(payment_list)
        assert len(payment_list) == 1  # Still only one payee
        assert payment_list[0]["amount"] == 2000  # But with double the reward
        assert payment_list[0]["explanationData"]["rollover_amount"] == "1000"


@patch("cardpay_reward_programs.utils.get_table_dataset")
def test_claimed_rewards_dont_rollover(get_table_dataset, rollover_rule):

    with TemporaryDirectory() as tempdir:
        tempdir = AnyPath(tempdir)

        # Generate the first output
        first_cycle_output = tempdir / "first_cycle_output"
        run_parameters = {
            "reward_program_id": "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72",
            "payment_cycle": 100,
        }
        payment_list = rollover_rule.get_payments(**run_parameters).to_dict("records")
        tree = PaymentTree(payment_list)
        table = tree.as_arrow()
        write_parquet_file(first_cycle_output, table)
        assert (first_cycle_output / "results.parquet").exists()

        # Create claims table
        first_leaf = table.to_pydict()["leaf"][0]
        get_table_dataset.return_value = claims_table([(first_leaf, 101)])

        # The second run should account for the previous one
        run_parameters = {
            "reward_program_id": "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72",
            "payment_cycle": 200,
            "previous_output": first_cycle_output / "results.parquet",
            "rewards_subgraph_location": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/",
        }
        payment_list = rollover_rule.get_payments(**run_parameters).to_dict("records")
        tree = PaymentTree(payment_list)
        assert len(payment_list) == 1  # Still only one payee
        assert (
            payment_list[0]["amount"] == 1000
        )  # And no extra payments as the value has not rolled over
        assert payment_list[0]["explanationData"]["rollover_amount"] == 0


@patch("cardpay_reward_programs.utils.get_table_dataset")
def test_multiple_claims_with_multiple_people(
    get_table_dataset, rollover_rule_multiple
):

    with TemporaryDirectory() as tempdir:
        tempdir = AnyPath(tempdir)

        # Generate the first output
        first_cycle_output = tempdir / "first_cycle_output"
        run_parameters = {
            "reward_program_id": "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72",
            "payment_cycle": 100,
        }
        payment_list = rollover_rule_multiple.get_payments(**run_parameters).to_dict(
            "records"
        )
        tree = PaymentTree(payment_list)
        table = tree.as_arrow()
        write_parquet_file(first_cycle_output, table)
        assert (first_cycle_output / "results.parquet").exists()

        # Create claims table
        first_leaf = table.to_pydict()["leaf"][0]
        second_leaf = table.to_pydict()["leaf"][1]
        get_table_dataset.return_value = claims_table(
            [(first_leaf, 101), (second_leaf, 103)]
        )

        # The second run should account for the previous one
        run_parameters = {
            "reward_program_id": "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72",
            "payment_cycle": 200,
            "previous_output": first_cycle_output / "results.parquet",
            "rewards_subgraph_location": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/",
        }
        payment_list = rollover_rule_multiple.get_payments(**run_parameters).to_dict(
            "records"
        )
        tree = PaymentTree(payment_list)
        assert len(payment_list) == 3  # All payees
        assert payment_list[0]["amount"] == 1000
        assert payment_list[1]["amount"] == 1000
        assert payment_list[2]["amount"] == 2000
        assert payment_list[0]["explanationData"]["rollover_amount"] == "0"
        assert payment_list[1]["explanationData"]["rollover_amount"] == "0"
        assert payment_list[2]["explanationData"]["rollover_amount"] == "1000"


@patch("cardpay_reward_programs.utils.get_table_dataset")
def test_default_rollover_amount_when_no_previous_output(_, rollover_rule):

    with TemporaryDirectory() as tempdir:
        tempdir = AnyPath(tempdir)

        run_parameters = {
            "reward_program_id": "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72",
            "payment_cycle": 100,
        }
        payment_list = rollover_rule.get_payments(**run_parameters).to_dict("records")
        assert payment_list[0]["explanationData"]["rollover_amount"] == "0"
