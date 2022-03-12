import hashlib
import itertools

import pandas as pd
import pytest
from cardpay_reward_programs.config import default_core_config
from cardpay_reward_programs.rules import MinSpend

from .fixture import indexed_data

df_hashes = [
    "c6a7dfaf3fa6b0d22104d07ebe675558b117054f54662cbfee6b82bf15198364",
    "c6a7dfaf3fa6b0d22104d07ebe675558b117054f54662cbfee6b82bf15198364",
    "c6a7dfaf3fa6b0d22104d07ebe675558b117054f54662cbfee6b82bf15198364",
]
summaries = [
    {"total_reward": 90, "unique_payee": 9},
    {"total_reward": 90, "unique_payee": 9},
    {"total_reward": 90, "unique_payee": 9},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
min_spend_ls = [2]

ans_ls = zip(df_hashes, summaries)


@pytest.fixture
def rule(request):
    payment_cycle_length, min_spend = request.param
    core_config = {
        **default_core_config,
        **{
            "payment_cycle_length": payment_cycle_length,
            "docker_image": "min_other_merchants_paid",
        },
    }
    user_config = {
        "base_reward": 10,
        "min_spend": min_spend,
        "token": "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
        "subgraph_config_location": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
        "duration": 43200,
    }
    return MinSpend(core_config, user_config)


class TestMinSpendSingle:
    @pytest.mark.parametrize(
        "rule,ans",
        zip(
            itertools.product(payment_cycle_length_ls, min_spend_ls),
            ans_ls,
        ),
        indirect=["rule"],
    )
    def test_run(self, rule, ans, indexed_data):
        df_hash, summary = ans
        start_block = 24000000
        end_block = 26000000
        rule.payment_cycle_length = end_block - start_block
        df = rule.run(end_block)
        payment_list = rule.df_to_payment_list(df)
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["total_reward"][0] == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]


multiple_df_hashes = [
    "016f5967731732f8879315395291cd9c95ad83e5c0364b11e41b0efa3980ace4",
    "ab33d395cbf0ebb1d5baa21ae2d3b0af5093ddef6e5c0d93f42a5a7ca1ecb08d",
    "c3f4c2d3c1978f2d1770e2d1c564951ff6ff028d2d68b2b442d77cf41351edf6",
]
multiple_summaries = [
    {"total_reward": 20, "unique_payee": 2},
    {"total_reward": 50, "unique_payee": 5},
    {"total_reward": 90, "unique_payee": 9},
]
multiple_ans_ls = zip(multiple_df_hashes, multiple_summaries)


class TestMinSpendMultiple:
    @pytest.mark.parametrize(
        "rule,ans",
        zip(
            itertools.product(payment_cycle_length_ls, min_spend_ls),
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
            cached_df.append(rule.run(tail))
        aggregate_df = rule.aggregate(cached_df)
        payment_list = rule.df_to_payment_list(aggregate_df)
        computed_summary = rule.get_summary(payment_list)
        h = hashlib.sha256(pd.util.hash_pandas_object(aggregate_df, index=True).values).hexdigest()
        assert computed_summary["total_reward"][0] == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]
        assert h == df_hash
