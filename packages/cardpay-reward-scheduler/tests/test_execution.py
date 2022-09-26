import pytest
from reward_scheduler.reward_program import RewardProgram
from tempfile import TemporaryDirectory
from cloudpathlib import AnyPath
from unittest.mock import patch


@patch('reward_scheduler.reward_program.run_job')
def test_identifies_previous_execution(mock_run_job):
    with TemporaryDirectory() as temp_dir:
        reward_program = RewardProgram(
            "0x0",
            "0x0",
            "http://",
            temp_dir
        )
        # Set processed cycles
        reward_program.processed_cycles = set()
        reward_program.run_rule({
            "core": {
                "payment_cycle_length": 100,
                "start_block": 1000,
                "end_block": 2000,
                "subgraph_config_locations": {},
                "docker_image": "image"
            },
            "user_defined": {
                "token": "0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1",
                "reward_per_user": 100000000000000000,
                "duration": 1209600,
                "accounts": ["0xF93944cF3638d2089B31F07E244a11380a5D0Ff3"]
            }
        })
        # load parameters from temp_dir
        assert mock_run_job.call_count == 10


