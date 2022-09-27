import pandas as pd

default_payment_list = pd.DataFrame(
    columns=[
        "rewardProgramID",
        "payee",
        "paymentCycle",
        "validFrom",
        "validTo",
        "token",
        "amount",
    ]
)


config = {
    "staging": {
        "tokens": {
            "card": "0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f",
            "dai": "0x8F4fdA26e5039eb0bf5dA90c3531AeB91256b56b",
        },
        "reward_program": "0x0885ce31D73b63b0Fcb1158bf37eCeaD8Ff0fC72",
        "rewards_bucket": "s3://cardpay-staging-reward-programs",
        "rewards_inventory_bucket": "s3://cardpay-staging-reward-programs-inventory",
        "subgraph_url": "https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol",
        "contracts": {"reward_pool": "0xcF8852D1aD746077aa4C31B423FdaE5494dbb57A"},
    },
    "production": {
        "tokens": {
            "card": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
            "dai": "0x26F2319Fbb44772e0ED58fB7c99cf8da59e2b5BE",
        },
        "reward_program": "0x979C9F171fb6e9BC501Aa7eEd71ca8dC27cF1185",
        "rewards_bucket": "s3://cardpay-production-reward-programs",
        "subgraph_url": "https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai",
        "contracts": {"reward_pool": "0x340EB99eB9aC7DB3a3eb68dB76c6F62738DB656a"},
    },
}
