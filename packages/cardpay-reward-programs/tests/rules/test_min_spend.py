import itertools

import pandas as pd
import pytest
from cardpay_reward_programs.config import config
from cardpay_reward_programs.rules import MinSpend

summaries = [
    {"total_reward": 90, "unique_payee": 9},
    {"total_reward": 90, "unique_payee": 9},
    {"total_reward": 90, "unique_payee": 9},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
min_spend_ls = [2]


@pytest.fixture
def rule(request):
    payment_cycle_length, min_spend = request.param
    core_config = {
        "start_block": 20000000,
        "end_block": 26000000,
        "payment_cycle_length": payment_cycle_length,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
    }
    user_config = {
        "base_reward": 10,
        "min_spend": min_spend,
        "token": config["staging"]["tokens"]["card"],
        "duration": 43200,
    }
    return MinSpend(core_config, user_config)


@pytest.mark.usefixtures("indexed_data")
class TestMinSpendSingle:
    @pytest.mark.parametrize(
        "rule,summary",
        zip(
            itertools.product(payment_cycle_length_ls, min_spend_ls),
            summaries,
        ),
        indirect=["rule"],
    )
    def test_run(self, rule, summary):
        start_block = 24000000
        end_block = 26000000
        rule.payment_cycle_length = end_block - start_block
        payment_list = rule.run(end_block, "0x0")
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["total_reward"][0] == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]


multiple_summaries = [
    {"total_reward": 30, "unique_payee": 2},
    {"total_reward": 80, "unique_payee": 5},
    {"total_reward": 110, "unique_payee": 9},
]


@pytest.mark.usefixtures("indexed_data")
class TestMinSpendMultiple:
    @pytest.mark.parametrize(
        "rule,summary",
        zip(
            itertools.product(payment_cycle_length_ls, min_spend_ls),
            multiple_summaries,
        ),
        indirect=["rule"],
    )
    def test_run(self, rule, summary):
        start_block = 24000000
        end_block = start_block + rule.payment_cycle_length * 10
        cached_df = []
        for i in range(start_block, end_block, rule.payment_cycle_length):
            tail = min(end_block, i + rule.payment_cycle_length)
            cached_df.append(rule.run(tail, "0x0"))
        payment_list = pd.concat(cached_df)
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["total_reward"][0] == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]
