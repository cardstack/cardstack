import hashlib
import itertools
from audioop import mul

import pandas as pd
import pytest
from cardpay_reward_programs.config import reward_token_addresses
from cardpay_reward_programs.rules import FlatPayment

from .fixture import indexed_data

summaries = [
    {"total_reward": 100 * 1_000_000_000_000_000_000, "unique_payee": 12},
    {"total_reward": 100 * 1_000_000_000_000_000_000, "unique_payee": 12},
    {"total_reward": 100 * 1_000_000_000_000_000_000, "unique_payee": 12},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
total_reward_ls = [100 * 1_000_000_000_000_000_000]


@pytest.fixture
def rule(request):
    payment_cycle_length, reward_per_user, accounts = request.param
    core_config = {
        "start_block": 23592960,
        "end_block": 24859648,
        "payment_cycle_length": payment_cycle_length,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
    }
    user_config = {
        "reward_per_user": reward_per_user,
        "token": reward_token_addresses["xdai"],
        "duration": 43200,
        "accounts": accounts,
    }
    return FlatPayment(core_config, user_config)


class TestFlatPayment:
    @pytest.mark.parametrize(
        "rule,expected_payees",
        [
            ((1024, 100 * 1_000_000_000_000_000_000, []), 0),
            (
                (
                    1024,
                    100 * 1_000_000_000_000_000_000,
                    ["0x41149498EAc53F8C15Fe848bC5f010039A130963"],
                ),
                1,
            ),
            (
                (
                    1024,
                    100 * 1_000_000_000_000_000_000,
                    [
                        "0x41149498EAc53F8C15Fe848bC5f010039A130963",
                        "0x76271cb51c7e5C0F0E9d2f1e4d6DFCD621e99eB7",
                    ],
                ),
                2,
            ),
        ],
        indirect=["rule"],
    )
    def test_pays_all(self, rule, expected_payees, indexed_data):
        payment_cycle = 24859648
        payment_list = rule.run(
            payment_cycle, "0x41149498EAc53F8C15Fe848bC5f010039A130963"
        )
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["unique_payee"][0] == expected_payees
        assert (
            pytest.approx(computed_summary["total_reward"][0])
            == expected_payees * 100 * 1_000_000_000_000_000_000
        )
