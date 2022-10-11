import json
from tempfile import TemporaryDirectory
from unittest.mock import patch

import pandas as pd
import pytest
from cloudpathlib import AnyPath
from reward_scheduler.reward_program import RewardProgram


@pytest.fixture
def non_rollover_rule():
    return {
        "core": {
            "payment_cycle_length": 100,
            "start_block": 1000,
            "end_block": 2000,
            "subgraph_config_locations": {},
            "docker_image": "image",
            "rollover": False,
            "duration": 20000,
        },
        "user_defined": {
            "token": "0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1",
            "reward_per_user": 100000000000000000,
            "accounts": ["0xF93944cF3638d2089B31F07E244a11380a5D0Ff3"],
        },
    }


@pytest.fixture
def rollover_rule():
    return {
        "core": {
            "payment_cycle_length": 100,
            "start_block": 1000,
            "end_block": 2000,
            "subgraph_config_locations": {},
            "docker_image": "image",
            "duration": 100,
            "rollover": True,
        },
        "user_defined": {
            "token": "0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1",
            "reward_per_user": 100000000000000000,
            "accounts": ["0xF93944cF3638d2089B31F07E244a11380a5D0Ff3"],
        },
    }


def create_submission_dataset(payment_cycles=[]):
    return pd.DataFrame(
        {
            "payment_cycle_uint64": list(payment_cycles),
            "reward_program": ["0x0"] * len(payment_cycles),
            "_block_number": list(payment_cycles),
        }
    )


def create_rewards_latest(directory, latest_block=5000):
    path = AnyPath(directory) / "rewards"
    path.mkdir(exist_ok=True)
    latest_location = path / "latest.yaml"
    with latest_location.open("w") as f:
        f.write(
            f"""
subgraph: habdelra/cardpay-sokol
subgraph_deployment: QmR4zkVGxHYVKi2TJoN8Xxni3RNgQ2Vs2Tw4booFgLUWdt
updated: 2022-01-31 22:43:31.534100
earliest_block: 0
latest_block: {latest_block}
        """
        )
    config_location = path / "config.yaml"
    with config_location.open("w") as f:
        f.write(
            """
name: rewards
subgraph: habdelra/cardpay-sokol
tables:
  merkle_root_submission:
    partition_sizes:
    - 524288
    - 131072
    - 16384
    - 1024
    - 2
"""
        )
    return path


@patch("reward_scheduler.reward_program.run_job")
@patch(
    "reward_scheduler.reward_program.get_table_dataset",
    return_value=create_submission_dataset(),
)
def test_executes_all_cycles(dataset, mock_run_job, non_rollover_rule):
    with TemporaryDirectory() as temp_dir:
        rewards_root = create_rewards_latest(temp_dir)
        reward_program = RewardProgram("0x0", "0x0", "http://", temp_dir, rewards_root)
        # Set processed cycles
        reward_program.processed_cycles = set()
        reward_program.run_rule(non_rollover_rule)
        assert mock_run_job.call_count == 10


@patch("reward_scheduler.reward_program.run_job")
@patch(
    "reward_scheduler.reward_program.get_table_dataset",
    return_value=create_submission_dataset(),
)
def test_rollover_only_runs_first_payment_cycle_when_none_processed(
    dataset, mock_run_job, rollover_rule
):
    with TemporaryDirectory() as temp_dir:
        rewards_root = create_rewards_latest(temp_dir)
        reward_program = RewardProgram("0x0", "0x0", "http://", temp_dir, rewards_root)
        # Set processed cycles
        reward_program.processed_cycles = set()
        reward_program.run_rule(rollover_rule)
        assert mock_run_job.call_count == 1
        assert (
            AnyPath(temp_dir)
            .joinpath("rewardProgramID=0x0", "paymentCycle=1000", "parameters.json")
            .exists()
        )


@patch("reward_scheduler.reward_program.run_job")
@patch(
    "reward_scheduler.reward_program.get_table_dataset",
    return_value=create_submission_dataset([1000, 1100]),
)
def test_rollover_only_cycles_with_fulfilled_dependencies(
    dataset, mock_run_job, rollover_rule
):
    with TemporaryDirectory() as temp_dir:
        rewards_root = create_rewards_latest(temp_dir)
        reward_program = RewardProgram("0x0", "0x0", "http://", temp_dir, rewards_root)
        reward_program.run_rule(rollover_rule)
        output_location = AnyPath(temp_dir).joinpath(
            "rewardProgramID=0x0", "paymentCycle=1200", "parameters.json"
        )
        previous_output_location = AnyPath(temp_dir).joinpath(
            "rewardProgramID=0x0", "paymentCycle=1100", "results.parquet"
        )

        assert mock_run_job.call_count == 1
        assert output_location.exists()

        with output_location.open() as f:
            written_parameters = json.load(f)
            assert (
                written_parameters["run"]["previous_output"]
                == previous_output_location.as_uri()
            )


@patch("reward_scheduler.reward_program.run_job")
@patch(
    "reward_scheduler.reward_program.get_table_dataset",
    return_value=create_submission_dataset([1000, 1100]),
)
def test_rollover_cant_run_if_rewards_extracts_too_old(
    dataset, mock_run_job, rollover_rule
):
    with TemporaryDirectory() as temp_dir:
        rewards_root = create_rewards_latest(temp_dir, latest_block=900)
        reward_program = RewardProgram("0x0", "0x0", "http://", temp_dir, rewards_root)
        reward_program.run_rule(rollover_rule)

        assert mock_run_job.call_count == 0
