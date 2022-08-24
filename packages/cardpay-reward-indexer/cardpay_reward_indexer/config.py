from functools import lru_cache

from pydantic import BaseSettings

config = {
    "staging": {
        "reward_program": "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72",
        "archived_reward_programs": [
        ],
        "reward_pool": "0xcF8852D1aD746077aa4C31B423FdaE5494dbb57A",
        "rewards_bucket": "s3://cardpay-staging-reward-programs",
        "subgraph_url": "https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol",
        "tokens": {
            "card": "0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f",
            "dai": "0x8F4fdA26e5039eb0bf5dA90c3531AeB91256b56b",
        },
    },
    "production": {
        "reward_program": "0x979C9F171fb6e9BC501Aa7eEd71ca8dC27cF1185",
        "archived_reward_programs": [],
        "rewards_bucket": "s3://cardpay-production-reward-programs",
        "subgraph_url": "https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai",
        "reward_pool": "0x340EB99eB9aC7DB3a3eb68dB76c6F62738DB656a",
        "tokens": {
            "card": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
            "dai": "0x26F2319Fbb44772e0ED58fB7c99cf8da59e2b5BE",
        },
    },
}

config["local"] = config["staging"]
config["test"] = config["staging"]


class Settings(BaseSettings):
    ENVIRONMENT: str = "local"
    SUBGRAPH_URL: str = config["staging"]["subgraph_url"]
    REWARDS_BUCKET: str = config["staging"]["rewards_bucket"]
    DB_STRING: str = "postgresql://postgres@localhost:5432/postgres"
    SENTRY_DSN: str = None

    class Config:
        fields = {
            "DB_STRING": {
                "env": "DB_STRING",
            },
            "SENTRY_DSN": {"env": "SENTRY_DSN"},
        }


@lru_cache
def get_settings():
    return Settings()
