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


def compute_summary(df):
    "aggregates columns of df"
    return {
        "reward_sum": df["amount"].sum(),
        "unique_payee": len(df["payee"].unique()),
        "total_transactions": df["transactions"].sum(),
        "total_spent": df["total_spent"].sum(),
    }


def check_summary(dict1, dict2):
    return dict1 == dict2


def create_program(payment_cycle_length, spend_factor, transaction_factor):
    config = "tests/data/cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1"
    reward_program_id = "test_reward"
    token = "test_token"
    valid_duration = 100000
    base_reward = 5
    program = UsageRewardProgram(config, reward_program_id, payment_cycle_length)
    program.set_parameters(token, base_reward, transaction_factor, spend_factor, valid_duration)
    return program


payment_cycle_length_ls = [1024, 1024 * 32, 1024 * 512]
spend_factor_ls = [2.0]
transaction_factor_ls = [2.0]
reward_programs_ls = list(
    map(
        lambda o: create_program(*o),
        itertools.product(payment_cycle_length_ls, spend_factor_ls, transaction_factor_ls),
    )
)


class TestSingleBlockUsage:
    "fix payment cycle. varying factor"

    @pytest.mark.parametrize(
        "reward_program,df_hash, summary", zip(reward_programs_ls, df_hashes, summaries)
    )
    def test_usage_single_payment_cycle(self, reward_program, df_hash, summary):
        payment_cycle = 24150016
        df = reward_program.run(payment_cycle)
        h = hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values).hexdigest()
        assert summary == compute_summary(df)
        assert h == df_hash


# # @pytest.mark.parametrize(
# #     "payment_cycle,df_hash",
# #     [
# #         (24150016, "82355f0d00621383e95da0a60671657fae4768c20a40a4f296c379cccfb2d7f1"),
# #         (24182784, "501374fad65cedaff9a87a1ee83c080292d662c2ceb8759ee607087f18dc050b"),
# #         (24543232, "7c55610ed742eabec5b07d0cd97f01f14630bacb813f8c00d4ca8f28ee5793a9"),
# #         (24641536, "b6c05b813142746e21a71f6e1c840493d7ccb5537cc2f491915c5bebfda811d1"),
# #         (24707072, "0c1169b54f1c40920950ad2744de66ba53fde946d0ad2f6cd1089898c1f8e496"),
# #         (24739840, "81a13f484c7f7bb51d14d9a8b1e0ba6941cf7b9782fafee10ff35a4942fefecc"),
# #         (24772608, "fb3acff83b0ff450afa9a537eb5df5376c7c96719915bac5552e17fed105c1b7"),
# #         (24805376, "547a7e27cbc286edcdfc1c25430f60ddf22055ccd47f1bf53be5abb5b75324d6"),
# #         (24838144, "019f1580b6f3f74bd45ccfe8017064196143c5b0916fd8d5f821d435ab7cd9f0"),
# #         (24870912, "6328c45a469bd8c71bb8aca5e95bc61097a9d0ceffa79a2c5371fe0dc123ec97"),
# #     ],
# # )
# # def test_usage_non_empty_df(payment_cycle, df_hash, reward_program):
# #     df = reward_program.run(payment_cycle)
# #     h = hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values).hexdigest()
# #     assert h == df_hash
