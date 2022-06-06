#!/usr/bin/env python3
from functools import lru_cache

from pydantic import BaseSettings, Field, SecretStr

config = {
    "staging": {
        "archived_reward_programs": [
            "0x0A4c62c8616342Fc3C5390c4e55aD26DeE694b0F",
            "0x64D65d17B26312c0a2532E3cfB0a681A92eEf89d",
            "0x73F92405b438D85ee46539a8FaDbBCa04C155F81",
            "0x954A9C27bC398B4A8f6F543b13eea833d0e73308",
            "0xd40c4b61D0B08548Dd1E2b79c1E8Ad98f15c65d8",
        ]
    },
    "production": {"archived_reward_programs": []},
}

config["local"] = config["staging"]
config["test"] = config["staging"]


class Settings(BaseSettings):
    ENVIRONMENT: str = "local"
    SUBGRAPH_URL: str = (
        "https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol"
    )
    REWARDS_BUCKET: str = "s3://tally-staging-reward-programs"
    DB_STRING: str = "postgresql://postgres@localhost:5432/postgres"
    SENTRY_DSN: str = None

    class Config:
        fields = {
            "DB_STRING": {
                "env": "DB_STRING",
            },
            "SENTRY_DSN": {"env": "SENTRY_DSN"},
        }


# @lru_cache()
def get_settings():
    return Settings()
