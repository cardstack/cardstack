import itertools
from audioop import mul

import pandas as pd
import pytest
from cardpay_reward_programs.config import reward_token_addresses
from cardpay_reward_programs.rules import RetroAirdrop

from .fixture import indexed_data

AIRDROP_AMOUNT = 6_000_000 * 1_000_000_000_000_000_000
TEST_AMOUNT = 100 * 1_000_000_000_000_000_000

summaries = [
    {"total_reward": AIRDROP_AMOUNT, "unique_payee": 12},
    {"total_reward": AIRDROP_AMOUNT, "unique_payee": 12},
    {"total_reward": AIRDROP_AMOUNT, "unique_payee": 12},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
total_reward_ls = [AIRDROP_AMOUNT]
test_accounts_ls = [[]]
test_amount_ls = [0]


@pytest.fixture
def rule(request):
    payment_cycle_length, total_reward, test_accounts, test_amount = request.param
    core_config = {
        "start_block": 23592960,
        "end_block": 24859648,
        "payment_cycle_length": payment_cycle_length,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
    }
    user_config = {
        "total_reward": total_reward,
        "token": reward_token_addresses["xdai"],
        "duration": 43200,
        "start_snapshot_block": 23592960,
        "end_snapshot_block": 24859648,
        "test_accounts": test_accounts,
        "test_reward": test_amount,
    }
    return RetroAirdrop(core_config, user_config)


class TestRetroAirdropSingle:
    @pytest.mark.parametrize(
        "rule,summary",
        zip(
            itertools.product(
                payment_cycle_length_ls,
                total_reward_ls,
                test_accounts_ls,
                test_amount_ls,
            ),
            summaries,
        ),
        indirect=["rule"],
    )
    def test_run(self, rule, summary, indexed_data):
        payment_cycle = 24859648
        payment_list = rule.run(payment_cycle, "0x0")
        computed_summary = rule.get_summary(payment_list)
        assert (
            pytest.approx(computed_summary["total_reward"][0])
            == summary["total_reward"]
        )
        assert computed_summary["unique_payee"][0] == summary["unique_payee"]

    @pytest.mark.parametrize(
        "rule,expected_payees",
        [
            ((1024, AIRDROP_AMOUNT, [], 0), 12),
            # we should use checksummed addresses
            (
                (
                    1024,
                    AIRDROP_AMOUNT,
                    ["0x41149498EAc53F8C15Fe848bC5f010039A130963"],
                    0,
                ),
                11,
            ),
            (
                (
                    1024,
                    AIRDROP_AMOUNT,
                    [
                        "0x41149498EAc53F8C15Fe848bC5f010039A130963",
                        "0x76271cb51c7e5C0F0E9d2f1e4d6DFCD621e99eB7",
                    ],
                    0,
                ),
                10,
            ),
        ],
        indirect=["rule"],
    )
    def test_removes_payee_when_no_test_reward(
        self, rule, expected_payees, indexed_data
    ):
        payment_cycle = 24859648
        payment_list = rule.run(
            payment_cycle, "0x41149498EAc53F8C15Fe848bC5f010039A130963"
        )
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["unique_payee"][0] == expected_payees
        assert pytest.approx(computed_summary["total_reward"][0]) == AIRDROP_AMOUNT

    @pytest.mark.parametrize(
        "rule,expected_payees,test_accounts",
        [
            ((1024, AIRDROP_AMOUNT, [], 0), 12, []),
            (
                (
                    1024,
                    AIRDROP_AMOUNT,
                    ["0x41149498EAc53F8C15Fe848bC5f010039A130963"],
                    TEST_AMOUNT,
                ),
                12,
                ["0x41149498EAc53F8C15Fe848bC5f010039A130963"],
            ),
            (
                (
                    1024,
                    AIRDROP_AMOUNT,
                    [
                        "0x41149498EAc53F8C15Fe848bC5f010039A130963",
                        "0x76271cb51c7e5C0F0E9d2f1e4d6DFCD621e99eB7",
                    ],
                    TEST_AMOUNT,
                ),
                12,
                [
                    "0x41149498EAc53F8C15Fe848bC5f010039A130963",
                    "0x76271cb51c7e5C0F0E9d2f1e4d6DFCD621e99eB7",
                ],
            ),
        ],
        indirect=["rule"],
    )
    def test_add_payee_reward(self, rule, expected_payees, test_accounts, indexed_data):
        payment_cycle = 24859648
        payment_list = rule.run(
            payment_cycle, "0x41149498EAc53F8C15Fe848bC5f010039A130963"
        )
        for account in test_accounts:
            assert account in payment_list["payee"].values
        computed_summary = rule.get_summary(payment_list)
        assert computed_summary["unique_payee"][0] == expected_payees
        assert pytest.approx(computed_summary["total_reward"][0]) == AIRDROP_AMOUNT + (
            TEST_AMOUNT * len(test_accounts)
        )

    @pytest.mark.parametrize(
        "test_accounts",
        [
            # Valid format, invalid checksum
            "0x41149498EAc53F8C15Fe848bC5F010039A130963",
            # Invalid formats
            [
                "0x41149498EAc53F8C15Fe8",
                "0x76271cb51",
            ],
            [
                "0x41149498EAc53F8C15Fe848bC5f010039A130963".lower(),
                "0x76271cb51c7e5C0F0E9d2f1e4d6DFCD621e99eB7".lower(),
            ],
            # First OK, second with an error
            [
                "0x41149498EAc53F8C15Fe848bC5f010039A130963",
                "0x76271cb51c7e5C0F0E9d2f1e4d6DFCD621e99eB7".lower(),
            ],
        ],
    )
    def test_errors_when_non_checksummed_addresses_used(
        self, test_accounts, indexed_data
    ):
        core_config = {
            "start_block": 23592960,
            "end_block": 24859648,
            "payment_cycle_length": 1024**2,
            "subgraph_config_locations": {
                "prepaid_card_payment": "s3://partitioned-graph-data/data/staging_rewards/0.0.1/"
            },
        }
        user_config = {
            "total_reward": 1_000_000_000_000,
            "token": reward_token_addresses["xdai"],
            "duration": 43200,
            "start_snapshot_block": 23592960,
            "end_snapshot_block": 24859648,
            "test_accounts": test_accounts,
            "test_reward": 1_000_000_000_000,
        }

        with pytest.raises(
            ValueError,
            match=r".* is not a valid checksum address",
        ):
            rule = RetroAirdrop(core_config, user_config)
