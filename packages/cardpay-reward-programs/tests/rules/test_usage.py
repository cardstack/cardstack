import pytest
from cardpay_reward_programs.programs.usage import UsageRewardProgram


@pytest.fixture
def reward_program():
    config = "/Users/tintinthong/Github/cardstack/packages/cardpay-reward-programs/test/data/cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1/"
    reward_program_id = "test_reward"
    token = "test_token"
    payment_cycle_length = 1024 * 32
    base_reward = 5
    transaction_factor = 2.0
    spend_factor = 2.0
    program = UsageRewardProgram(config, reward_program_id, payment_cycle_length)
    program.set_parameters(token, base_reward, transaction_factor, spend_factor, 100000)
    return program


def test_usage(reward_program):
    print(reward_program)
    assert 42 == 42
