import hashlib
import itertools
from turtle import end_fill

import pandas as pd
import pytest
from cardpay_reward_programs.config import default_core_config
from cardpay_reward_programs.rules import WeightedUsage

from .fixture import indexed_data


summaries = [
    {"total_reward": 106, "unique_payee": 9},
    {"total_reward": 106, "unique_payee": 9},
    {"total_reward": 106, "unique_payee": 9},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
spend_factor_ls = [2.0]
transaction_factor_ls = [2.0]


@pytest.fixture
def rule(request):
    payment_cycle_length, spend_factor, transaction_factor = request.param
    core_config = {
        **default_core_config,
        **{"payment_cycle_length": payment_cycle_length},
    }
    user_config = {
        "base_reward": 10,
        "transaction_factor": transaction_factor,
        "spend_factor": spend_factor,
        "token": "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
        "subgraph_config_location": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
        "duration": 43200,
    }
    return WeightedUsage(core_config, user_config)


class TestWeightedUsageSingle:
    @pytest.mark.parametrize(
        "rule,summary",
        zip(
            itertools.product(payment_cycle_length_ls, spend_factor_ls, transaction_factor_ls),
            summaries,
        ),
        indirect=["rule"],
    )
    def test_run(self, rule, summary, indexed_data):
        start_block = 24000000
        end_block = 26000000
        rule.payment_cycle_length = end_block - start_block
        payment_list = rule.run(end_block, "0x0")
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["total_reward"][0] == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]


range_summaries = [
    [{"block": 24001024, "amount": 0}],
    [{"block": 24032768, "amount": 49}],
    [{"block": 24524288, "amount": 60}],
]
range_ans_ls = zip(range_summaries)


class TestWeightedUsageMultiple:
    @pytest.mark.parametrize(
        "rule,ans",
        zip(
            itertools.product(payment_cycle_length_ls, spend_factor_ls, transaction_factor_ls),
            range_ans_ls,
        ),
        indirect=["rule"],
    )
    def test_run(self, rule, ans, indexed_data):
        (range_summary,) = ans
        start_block = 24000000
        end_block = start_block + rule.payment_cycle_length * 10
        payments = []
        for i in range(start_block, end_block, rule.payment_cycle_length):
            tail = min(end_block, i + rule.payment_cycle_length)
            df = rule.run(tail, "0x0")
            payments.append({"block": tail, "amount": df["amount"].sum()})
        assert payments[0]["amount"] == range_summary[0]["amount"]
        assert payments[0]["block"] == range_summary[0]["block"]
