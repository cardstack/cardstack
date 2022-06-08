from .reward_program import RewardProgram
from web3 import Web3
import os
import sentry_sdk
import json
import schedule
import logging
import time
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
load_dotenv()

SENTRY_DSN = os.environ.get("SENTRY_DSN")
if SENTRY_DSN is not None:
    for expected_env in [
        "ENVIRONMENT",
    ]:
        if expected_env not in os.environ:
            raise ValueError(f"Missing environment variable {expected_env}")
    sentry_sdk.init(
        SENTRY_DSN,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0,
        environment=os.environ.get("ENVIRONMENT"),
    )

for expected_env in [
    "EVM_FULL_NODE_URL",
    "REWARD_MANAGER_ADDRESS",
    "REWARDS_BUCKET",
    "REWARD_SCHEDULER_APPROVED_PROGRAMS",
    "SUBGRAPH_URL",
]:
    if expected_env not in os.environ:
        raise ValueError(f"Missing environment variable {expected_env}")

SUBGRAPH_URL = os.environ.get("SUBGRAPH_URL")
REWARDS_BUCKET = os.environ.get("REWARDS_BUCKET")
EVM_FULL_NODE_URL = os.environ.get("EVM_FULL_NODE_URL")
REWARD_SCHEDULER_APPROVED_PROGRAMS = os.environ.get(
    "REWARD_SCHEDULER_APPROVED_PROGRAMS"
)
REWARD_MANAGER_ADDRESS = os.environ.get("REWARD_MANAGER_ADDRESS")
REWARDS_SUBGRAPH_EXTRACTION = os.environ.get("REWARDS_SUBGRAPH_EXTRACTION")
REWARD_SCHEDULER_UPDATE_FREQUENCY = int(
    os.environ.get("REWARD_SCHEDULER_UPDATE_FREQUENCY", 600)
)


def safe_run(reward_program):
    try:
        reward_program.run_all_payment_cycles()
    except Exception as e:
        logging.error(
            f"Error running reward program {reward_program.reward_program_id}, {e}"
        )


def main():
    w3 = Web3(Web3.HTTPProvider(EVM_FULL_NODE_URL))
    with open(f"abis/RewardManager.json") as contract_file:
        contract = json.load(contract_file)
    reward_manager = w3.eth.contract(
        address=REWARD_MANAGER_ADDRESS, abi=contract["abi"]
    )
    for reward_program_id in REWARD_SCHEDULER_APPROVED_PROGRAMS.split(","):
        reward_program_id = reward_program_id.strip()
        reward_program = RewardProgram(
            reward_program_id,
            reward_manager,
            SUBGRAPH_URL,
            REWARDS_BUCKET,
            REWARDS_SUBGRAPH_EXTRACTION,
        )
        logging.info(
            f"Setting regular processing every {REWARD_SCHEDULER_UPDATE_FREQUENCY} seconds for {reward_program_id}"
        )
        schedule.every(REWARD_SCHEDULER_UPDATE_FREQUENCY).seconds.do(
            safe_run, reward_program=reward_program
        )
        # When we start, run all scheduled tasks rather than waiting 10 minutes
        schedule.run_all()
    # Go into an infinite loop
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    main()
