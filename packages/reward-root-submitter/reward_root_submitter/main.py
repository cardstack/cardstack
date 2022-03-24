import logging
import os
import time

import schedule
from dotenv import load_dotenv
from web3 import Web3

from .submitter import RootSubmitter

load_dotenv()  # take environment variables from .env

LOGLEVEL = os.environ.get("LOGLEVEL", "WARNING").upper()
logging.basicConfig(level=LOGLEVEL)


def run_all():

    for expected_env in [
        "EVM_FULL_NODE_URL",
        "OWNER",
        "OWNER_PRIVATE_KEY",
        "REWARD_POOL_ADDRESS",
        "REWARD_PROGRAM_OUTPUT",
    ]:
        if expected_env not in os.environ:
            raise ValueError(f"Missing environment variable {expected_env}")

    submitter = RootSubmitter(
        Web3(Web3.HTTPProvider(os.getenv("EVM_FULL_NODE_URL"))),
        os.getenv("OWNER"),
        os.getenv("OWNER_PRIVATE_KEY"),
        os.getenv("REWARD_POOL_ADDRESS"),
        os.getenv("REWARD_PROGRAM_OUTPUT"),
    )
    # Default to one minute
    frequency = os.getenv("SUBMIT_FREQUENCY", 60)
    schedule.every(frequency).seconds.do(submitter.submit_all_roots)
    schedule.run_all()
    # Go into an infinite loop
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    run_all()
