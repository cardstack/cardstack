import hashlib
import itertools

import pandas as pd
import pytest
from cardpay_reward_programs.config import default_core_config
from cardpay_reward_programs.rules import WeightedUsage

from .fixture import indexed_data

df_hashes = [
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "c3fcafadd333c8cb2491ca39e8fa095a88ccadedd5f2563ed18428fba1157ca0",
    "132b9b42c63057d3403bdec75a0ace765e5b2fd248316b7568481a7c8ec1126a",
]
summaries = [
    {"total_reward": 0, "unique_payee": 0, "total_transactions": 0, "total_spent": 0.0},
    {"total_reward": 24, "unique_payee": 2, "total_transactions": 5, "total_spent": 300.0},
    {"total_reward": 83, "unique_payee": 7, "total_transactions": 113, "total_spent": 12498.0},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
spend_factor_ls = [2.0]
transaction_factor_ls = [2.0]

ans_ls = zip(df_hashes, summaries)


@pytest.fixture
def rule(request):
    payment_cycle_length, spend_factor, transaction_factor = request.param
    core_config = {**default_core_config, **{"payment_cycle_length": payment_cycle_length}}
    user_config = {
        "base_reward": 10,
        "transaction_factor": transaction_factor,
        "spend_factor": spend_factor,
    }
    return WeightedUsage(core_config, user_config)


class TestWeightedUsageSingle:
    @pytest.mark.parametrize(
        "rule,ans",
        zip(
            itertools.product(payment_cycle_length_ls, spend_factor_ls, transaction_factor_ls),
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


range_summaries = [
    [{"block": 24150016, "amount": 0}],
    [{"block": 24150016, "amount": 24}],
    [{"block": 24150016, "amount": 83}],
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
        start_payment_cycle = 24150016
        end_payment_cycle = start_payment_cycle + 1024
        payments = []
        min_block = start_payment_cycle
        max_block = end_payment_cycle
        for i in range(min_block, max_block, rule.payment_cycle_length):
            df = rule.run(i)
            payments.append({"block": i, "amount": df["amount"].sum()})
        assert payments[0]["amount"] == range_summary[0]["amount"]
        assert payments[0]["block"] == range_summary[0]["block"]
