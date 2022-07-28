from functools import lru_cache

from pydantic import BaseSettings

config = {
    "staging": {
        "reward_pool": "0xc9A238Ee71A65554984234DF9721dbdA873F84FA",
        "tokens": {
            "card": "0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee",
        },
    },
    "production": {
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
    REWARDS_BUCKET: str = "s3://cardpay-staging-reward-programs"
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
