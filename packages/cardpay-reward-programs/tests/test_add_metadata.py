import json
from tempfile import TemporaryDirectory

import pyarrow.parquet as pq
from cardpay_reward_programs.payment_tree import PaymentTree
from cardpay_reward_programs.utils import write_parquet_file
from cloudpathlib import AnyPath


def test_adds_metadata_to_payment_tree():
    # Values don't matter here, but this is representative of nested data
    metadata = {
        "core": {
            "start_block": 20000000,
            "end_block": 26000000,
            "payment_cycle_length": 100,
            "subgraph_config_locations": {
                "prepaid_card_payment": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/"
            },
        },
        "run": {
            "reward_program_id": "0x0000000000000000000000000000000000000000",
            "payment_cycle": 1,
        },
        "user_defined": {
            "base_reward": 10,
            "min_other_merchants": 1,
            "token": "0x0000000000000000000000000000000000000000",
            "duration": 43200,
        },
        "metadata": {"explanation_id": "min_other_merchants"},
    }
    tree = PaymentTree(
        [
            {
                "rewardProgramID": "0x0000000000000000000000000000000000000000",
                "paymentCycle": 0,
                "validFrom": 0,
                "validTo": 0,
                "payee": "0x0000000000000000000000000000000000000000",
                "token": "0x0000000000000000000000000000000000000000",
                "amount": 0,
                "explanationData": {},
            }
        ],
        parameters=metadata,
    )

    with TemporaryDirectory() as path:
        write_parquet_file(AnyPath(path), tree.as_arrow())
        table_on_disk = pq.read_table(AnyPath(path) / "results.parquet")
        written_metadata = table_on_disk.schema.metadata
        # Note - keys here are *bytes* not strings
        parameters = json.loads(written_metadata[b"parameters"])
        assert parameters == metadata
