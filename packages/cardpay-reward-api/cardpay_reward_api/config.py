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
        ],
        "reward_pool": "0xc9A238Ee71A65554984234DF9721dbdA873F84FA",
        "tokens": {
            "card": "0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee",
        },
    },
    "production": {
        "archived_reward_programs": [],
        "reward_pool": "0x340EB99eB9aC7DB3a3eb68dB76c6F62738DB656a",
        "tokens": {
            "card": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
        },
    },
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
    EVM_FULL_NODE_URL: str = "https://sokol-archive.blockscout.com"
    SENTRY_DSN: str = None

    class Config:
        fields = {
            "DB_STRING": {
                "env": "DB_STRING",
            },
            "SENTRY_DSN": {"env": "SENTRY_DSN"},
            "EVM_FULL_NODE_URL": {"env": "EVM_FULL_NODE_URL"},
        }


@lru_cache
def get_settings():
    return Settings()
