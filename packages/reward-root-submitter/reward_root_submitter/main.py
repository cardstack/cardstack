import logging
import os
import time

import schedule
import sentry_sdk
from dotenv import load_dotenv
from web3 import Web3

from .submitter import RootSubmitter

load_dotenv()  # take environment variables from .env
for expected_env in [
    "EVM_FULL_NODE_URL",
    "OWNER",
    "OWNER_PRIVATE_KEY",
    "REWARD_POOL_ADDRESS",
    "REWARD_PROGRAM_OUTPUT",
    "ENVIRONMENT",
]:
    if expected_env not in os.environ:
        raise ValueError(f"Missing environment variable {expected_env}")

LOGLEVEL = os.environ.get("LOGLEVEL", "WARNING").upper()
logging.basicConfig(level=LOGLEVEL)
SENTRY_DSN = os.environ.get("SENTRY_DSN")
if SENTRY_DSN is not None:
    sentry_sdk.init(
        SENTRY_DSN,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0,
        environment=os.environ.get("ENVIRONMENT"),
    )


def run_all():

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
