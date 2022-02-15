import hashlib

import numpy as np
import pandas as pd
import pytest
from cardpay_reward_programs.programs.usage import UsageRewardProgram


@pytest.fixture
def reward_program():
    config = "/Users/tintinthong/Github/cardstack/packages/cardpay-reward-programs/tests/data/cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1"
    reward_program_id = "test_reward"
    token = "test_token"
    payment_cycle_length = 1024 * 32
    base_reward = 5
    transaction_factor = 2.0
    spend_factor = 2.0
    valid_duration = 100000
    program = UsageRewardProgram(config, reward_program_id, payment_cycle_length)
    program.set_parameters(token, base_reward, transaction_factor, spend_factor, valid_duration)
    return program


def test_usage_single_payment_cycle(reward_program):
    payment_cycle = 24150016
    df = reward_program.run(payment_cycle)
    assert len(df["payee"].unique()) == 2
    assert df["amount"].sum() == 14
    assert df["transactions"].sum() == 5
    assert df["total_spent"].sum() == 300


df_hashes = [
    "82355f0d00621383e95da0a60671657fae4768c20a40a4f296c379cccfb2d7f1",
    "501374fad65cedaff9a87a1ee83c080292d662c2ceb8759ee607087f18dc050b",
    "7c55610ed742eabec5b07d0cd97f01f14630bacb813f8c00d4ca8f28ee5793a9",
    "b6c05b813142746e21a71f6e1c840493d7ccb5537cc2f491915c5bebfda811d1",
    "0c1169b54f1c40920950ad2744de66ba53fde946d0ad2f6cd1089898c1f8e496",
    "81a13f484c7f7bb51d14d9a8b1e0ba6941cf7b9782fafee10ff35a4942fefecc",
    "fb3acff83b0ff450afa9a537eb5df5376c7c96719915bac5552e17fed105c1b7",
    "547a7e27cbc286edcdfc1c25430f60ddf22055ccd47f1bf53be5abb5b75324d6",
    "019f1580b6f3f74bd45ccfe8017064196143c5b0916fd8d5f821d435ab7cd9f0",
    "6328c45a469bd8c71bb8aca5e95bc61097a9d0ceffa79a2c5371fe0dc123ec97",
]


@pytest.mark.parametrize(
    "payment_cycle,df_hash",
    [
        (24150016, "82355f0d00621383e95da0a60671657fae4768c20a40a4f296c379cccfb2d7f1"),
        (24182784, "501374fad65cedaff9a87a1ee83c080292d662c2ceb8759ee607087f18dc050b"),
        (24543232, "7c55610ed742eabec5b07d0cd97f01f14630bacb813f8c00d4ca8f28ee5793a9"),
        (24641536, "b6c05b813142746e21a71f6e1c840493d7ccb5537cc2f491915c5bebfda811d1"),
        (24707072, "0c1169b54f1c40920950ad2744de66ba53fde946d0ad2f6cd1089898c1f8e496"),
        (24739840, "81a13f484c7f7bb51d14d9a8b1e0ba6941cf7b9782fafee10ff35a4942fefecc"),
        (24772608, "fb3acff83b0ff450afa9a537eb5df5376c7c96719915bac5552e17fed105c1b7"),
        (24805376, "547a7e27cbc286edcdfc1c25430f60ddf22055ccd47f1bf53be5abb5b75324d6"),
        (24838144, "019f1580b6f3f74bd45ccfe8017064196143c5b0916fd8d5f821d435ab7cd9f0"),
        (24870912, "6328c45a469bd8c71bb8aca5e95bc61097a9d0ceffa79a2c5371fe0dc123ec97"),
    ],
)
def test_usage_non_empty_df(payment_cycle, df_hash, reward_program):
    df = reward_program.run(payment_cycle)
    h = hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values).hexdigest()
    assert h == df_hash
