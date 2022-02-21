import hashlib
import itertools

import pandas as pd
import pytest
from cardpay_reward_programs.programs.usage import UsageRewardProgram

df_hashes = [
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "82355f0d00621383e95da0a60671657fae4768c20a40a4f296c379cccfb2d7f1",
    "f692dd2406a3a4d11740448d8c080edf96a82c985f9e67d920e14615120b8ffc",
]
summaries = [
    {"reward_sum": 0, "unique_payee": 0, "total_transactions": 0, "total_spent": 0.0},
    {"reward_sum": 14, "unique_payee": 2, "total_transactions": 5, "total_spent": 300.0},
    {"reward_sum": 48, "unique_payee": 7, "total_transactions": 113, "total_spent": 12498.0},
]

range_summaries = [
    [{"block": 24150016, "amount": 0}],
    [{"block": 24150016, "amount": 14}],
    [{"block": 24150016, "amount": 48}],
]


def compute_summary(df):
    "aggregates columns of df"
    return {
        "reward_sum": df["amount"].sum(),
        "unique_payee": len(df["payee"].unique()),
        "total_transactions": df["transactions"].sum(),
        "total_spent": df["total_spent"].sum(),
    }


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
spend_factor_ls = [2.0]
transaction_factor_ls = [2.0]


params_ls = itertools.product(payment_cycle_length_ls, spend_factor_ls, transaction_factor_ls)

ans_ls = zip(df_hashes, summaries)

range_ans_ls = zip(range_summaries)


def create_program(payment_cycle_length, spend_factor, transaction_factor):
    config = "tests/data/cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1"
    reward_program_id = "test_reward"
    token = "test_token"
    valid_duration = 100000
    base_reward = 5
    program = UsageRewardProgram(config, reward_program_id, payment_cycle_length)
    program.set_parameters(token, base_reward, transaction_factor, spend_factor, valid_duration)
    return program


class TestBlockRangeUsage:
    "multiple payment cycle ranges"

    @pytest.mark.parametrize("params,ans", zip(params_ls, range_ans_ls))
    def test_run(self, params, ans):
        reward_program = create_program(*params)
        (range_summary,) = ans
        start_payment_cycle = 24150016
        end_payment_cycle = start_payment_cycle + 1024
        payments = reward_program.run_n(start_payment_cycle, end_payment_cycle)
        assert payments[0]["amount"] == range_summary[0]["amount"]
        assert payments[0]["block"] == range_summary[0]["block"]


class TestSingleBlockUsage:
    "fix payment cycle. varying factor"

    @pytest.mark.parametrize(
        "params,ans",
        zip(params_ls, ans_ls),
    )
    def test_run(self, params, ans):
        df_hash, summary = ans
        payment_cycle = 24150016
        reward_program = create_program(*params)
        df = reward_program.run(payment_cycle)
        h = hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values).hexdigest()
        assert summary == compute_summary(df)
        assert h == df_hash
