from audioop import mul
import hashlib
import itertools

import pandas as pd
import pytest
from cardpay_reward_programs.rules import RetroAirdrop

from .fixture import indexed_data


summaries = [
    {"total_reward": 10000000.0, "unique_payee": 12},
    {"total_reward": 10000000.0, "unique_payee": 12},
    {"total_reward": 10000000.0, "unique_payee": 12},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
total_reward_ls = [10000000]
excluded_accounts_ls = [[]]



@pytest.fixture
def rule(request):
    payment_cycle_length, total_reward, excluded_accounts = request.param
    core_config = {
        "start_block": 23592960,
        "end_block": 24859648,
        "payment_cycle_length": payment_cycle_length,
    }
    user_config = {
        "total_reward": total_reward,
        "token": "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
        "subgraph_config_location": {
            "prepaid_card_payment": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
        "duration": 43200,
        "start_snapshot_block": 23592960,
        "end_snapshot_block": 24859648,
        "excluded_accounts": excluded_accounts,
    }
    return RetroAirdrop(core_config, user_config)


class TestRetroAirdropSingle:
    @pytest.mark.parametrize(
        "rule,summary",
        zip(
            itertools.product(payment_cycle_length_ls, total_reward_ls, excluded_accounts_ls),
            summaries,
        ),
        indirect=["rule"],
    )
    def test_run(self, rule, summary, indexed_data):
        payment_cycle = 24859648
        payment_list = rule.run(payment_cycle, "0x0")
        computed_summary = rule.get_summary(payment_list)
        assert pytest.approx(computed_summary["total_reward"][0]) == summary["total_reward"]
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]
    
    @pytest.mark.parametrize(
        "rule,expected_payees",
        [
            ((1024, 10000000, []), 12),
            # we should use checksummed addresses
            ((1024, 10000000, ["0x41149498EAc53F8C15Fe848bC5f010039A130963"]), 11),
            ((1024, 10000000, ["0x41149498EAc53F8C15Fe848bC5f010039A130963", "0x76271cb51c7e5C0F0E9d2f1e4d6DFCD621e99eB7"]), 10),
            # we should use checksummed addresses but it shouldn't break if we don't
            ((1024, 10000000, ["0x41149498EAc53F8C15Fe848bC5f010039A130963".lower()]), 11),
            ((1024, 10000000, ["0x41149498EAc53F8C15Fe848bC5f010039A130963".upper()]), 11),
        ],
        indirect=["rule"],
    )
    def test_removes_payee(self, rule, expected_payees, indexed_data):
        payment_cycle = 24859648
        payment_list = rule.run(payment_cycle, "0x0")
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["unique_payee"][0] == expected_payees
        assert pytest.approx(computed_summary["total_reward"][0]) == 10000000