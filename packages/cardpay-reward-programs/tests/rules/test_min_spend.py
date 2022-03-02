import hashlib
import itertools

import pandas as pd
import pytest
from cardpay_reward_programs.config import default_core_config
from cardpay_reward_programs.rules import MinSpend

from .fixture import indexed_data

df_hashes = [
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "8f24ed673fb7cacc374a3d320249440b5c325628fae603eabb025dc8719edc4a",
    "ebf876092c147099624dc7c6b1317b5767f52b19ce611244be72ff360bd6c193",
]
summaries = [
    {"total_reward": 0, "unique_payee": 0},
    {"total_reward": 20, "unique_payee": 2},
    {"total_reward": 70, "unique_payee": 7},
]


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
min_spend_ls = [2.0]

ans_ls = zip(df_hashes, summaries)


@pytest.fixture
def rule(request):
    payment_cycle_length, min_spend = request.param
    core_config = {**default_core_config, **{"payment_cycle_length": payment_cycle_length}}
    user_config = {
        "base_reward": 10,
        "min_spend": min_spend,
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
    "8f24ed673fb7cacc374a3d320249440b5c325628fae603eabb025dc8719edc4a",
    "8abe4a6b017dddc6b803429dd3b3eea43c3ebfae0a31b871709d5a0569b7c459",
]
multiple_summaries = [
    {"total_reward": 0, "unique_payee": 0},
    {"total_reward": 20, "unique_payee": 2},
    {"total_reward": 70, "unique_payee": 7},
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
        start_payment_cycle = 24150016
        end_payment_cycle = start_payment_cycle + 1024
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
