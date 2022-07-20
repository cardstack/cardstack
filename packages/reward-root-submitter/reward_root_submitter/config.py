from pydantic import BaseSettings, root_validator, Field
import boto3
from functools import lru_cache

@lru_cache
def get_secrets_client():
    return boto3.client("secretsmanager")

@lru_cache
def get_secret(secret_id):
    client = get_secrets_client()
    secret_value = client.get_secret_value(SecretId=secret_id)
    return secret_value["SecretString"]


class Config(BaseSettings):

    environment: str
    evm_full_node_url: str
    reward_root_submitter_address: str
    reward_root_submitter_private_key: str
    reward_root_submitter_sentry_dsn: str
    log_level: str = Field("WARNING")

    @root_validator(pre=True)
    def load_secrets(cls, values):
        client = boto3.client("secretsmanager")
        env = values["environment"]
        for field_name, field in cls.__fields__.items():
            # Check it isn't already set *and* there is no default
            if field_name not in values and field.default is None:
                values[field_name] = get_secret(f"{env}_{field_name}")
        return values

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
