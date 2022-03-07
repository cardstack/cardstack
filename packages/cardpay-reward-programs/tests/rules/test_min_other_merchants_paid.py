import hashlib
import itertools

import pandas as pd
import pytest
from cardpay_reward_programs.config import default_core_config
from cardpay_reward_programs.rules import MinOtherMerchantsPaid

from .fixture import indexed_data

df_hashes = [
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "f45c509908a1eba5eab02d30112b3d5153a9939df3d0e58cb4a11fadb11272c8",
    "c8fa9b5e0399ab2a986d4c8c82c4fead0581235557adcff6a09b14345a1dae95",
]
summaries = [
    {"total_reward": 0, "unique_payee": 0},
    {"total_reward": 10, "unique_payee": 1},
    {"total_reward": 30, "unique_payee": 3},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
min_spend_ls = [1]

ans_ls = zip(df_hashes, summaries)


@pytest.fixture
def rule(request):
    payment_cycle_length, min_other_merchants = request.param
    core_config = {
        **default_core_config,
        **{
            "payment_cycle_length": payment_cycle_length,
            "docker_image": "min_other_merchants_paid",
        },
    }
    user_config = {
        "base_reward": 10,
        "min_other_merchants": min_other_merchants,
        "token": "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
        "subgraph_config_location": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
        "duration": 43200,
    }
    return MinOtherMerchantsPaid(core_config, user_config)


class TestMinOtherMerchantsPaidSingle:
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
        payment_cycle = 24150016
        df = rule.run(payment_cycle)
        payment_list = rule.df_to_payment_list(df)
        h = hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values).hexdigest()
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["total_reward"][0] == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]
        assert h == df_hash


multiple_df_hashes = [
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "f45c509908a1eba5eab02d30112b3d5153a9939df3d0e58cb4a11fadb11272c8",
    "c8fa9b5e0399ab2a986d4c8c82c4fead0581235557adcff6a09b14345a1dae95",
]
multiple_summaries = [
    {"total_reward": 0, "unique_payee": 0},
    {"total_reward": 10, "unique_payee": 1},
    {"total_reward": 30, "unique_payee": 3},
]
multiple_ans_ls = zip(multiple_df_hashes, multiple_summaries)


class TestMinOtherMerchantsPaidMultiple:
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
        start_payment_cycle = 24150016
        end_payment_cycle = start_payment_cycle + 1024 * 32
        min_block = start_payment_cycle
        max_block = end_payment_cycle
        cached_df = []
        for i in range(min_block, max_block, rule.payment_cycle_length):
            cached_df.append(rule.run(i))
        aggregate_df = rule.aggregate(cached_df)
        payment_list = rule.df_to_payment_list(aggregate_df)
        computed_summary = rule.get_summary(payment_list)
        h = hashlib.sha256(pd.util.hash_pandas_object(aggregate_df, index=True).values).hexdigest()
        assert computed_summary["total_reward"][0] == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]
        assert h == df_hash
