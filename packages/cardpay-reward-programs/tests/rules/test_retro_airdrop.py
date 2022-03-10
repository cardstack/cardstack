import hashlib
import itertools

import pandas as pd
import pytest
from cardpay_reward_programs.config import default_core_config
from cardpay_reward_programs.rules import RetroAirdrop

from .fixture import indexed_data

df_hashes = [
    "3163ac326bdb5d25cc91c5ab3e2db4574be1545af49cfad7dc1f336a35907441",
    "3163ac326bdb5d25cc91c5ab3e2db4574be1545af49cfad7dc1f336a35907441",
    "3163ac326bdb5d25cc91c5ab3e2db4574be1545af49cfad7dc1f336a35907441",
]
summaries = [
    {"total_reward": 10000000.0, "unique_payee": 9},
    {"total_reward": 10000000.0, "unique_payee": 9},
    {"total_reward": 10000000.0, "unique_payee": 9},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
total_reward_ls = [10000000]

ans_ls = zip(df_hashes, summaries)


@pytest.fixture
def rule(request):
    payment_cycle_length, total_reward = request.param
    core_config = {
        **default_core_config,
        **{
            "payment_cycle_length": payment_cycle_length,
            "docker_image": "retro_airdrop",
        },
    }
    user_config = {
        "total_reward": total_reward,
        "token": "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
        "subgraph_config_location": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
        "duration": 43200,
        "start_snapshot_block": 24000000,
        "end_snapshot_block": 26000000,
    }
    return RetroAirdrop(core_config, user_config)


class TestRetroAirdropSingle:
    @pytest.mark.parametrize(
        "rule,ans",
        zip(
            itertools.product(payment_cycle_length_ls, total_reward_ls),
            ans_ls,
        ),
        indirect=["rule"],
    )
    def test_run(self, rule, ans, indexed_data):
        df_hash, summary = ans
        start_block = 24000000
        end_block = 26000000
        df = rule.run(start_block, end_block)
        payment_list = rule.df_to_payment_list(df)
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["total_reward"][0] == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]


multiple_df_hashes = [
    "1d0240ce4a3116e0818ba3f4b19bc3f2f0ab2ff17926a5fd3ce5504bbfa0f500",
    "3a7baa0b9d9585d994d4356a0fd932ba086ad25249210d6a34349623e1606306",
    "396ffae575a77895584de8c93d879285e1745e85c123138744f041ff629269fb",
]
multiple_summaries = [
    {"total_reward": 600000.0, "unique_payee": 2},
    {"total_reward": 4200000.0, "unique_payee": 5},
    {"total_reward": 10000000.0, "unique_payee": 9},
]
multiple_ans_ls = zip(multiple_df_hashes, multiple_summaries)


class TestRetroAirdropMultiple:
    @pytest.mark.parametrize(
        "rule,ans",
        zip(
            itertools.product(payment_cycle_length_ls, total_reward_ls),
            multiple_ans_ls,
        ),
        indirect=["rule"],
    )
    def test_run(self, rule, ans, indexed_data):
        (df_hash, summary) = ans
        start_block = 24000000
        end_block = start_block + rule.payment_cycle_length * 10
        cached_df = []
        for i in range(start_block, end_block, rule.payment_cycle_length):
            tail = min(end_block, i + rule.payment_cycle_length)
            cached_df.append(rule.run(i, tail))
        aggregate_df = rule.aggregate(cached_df)
        payment_list = rule.df_to_payment_list(aggregate_df)
        computed_summary = rule.get_summary(payment_list)
        h = hashlib.sha256(pd.util.hash_pandas_object(aggregate_df, index=True).values).hexdigest()
        assert computed_summary["total_reward"][0] == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]
        assert h == df_hash
