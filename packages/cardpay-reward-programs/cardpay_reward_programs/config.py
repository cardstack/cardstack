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
            "card": "0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee",
        },
        "reward_program": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA",
        "rewards_bucket": "s3://tally-staging-reward-programs",
    },
    "production": {
        "tokens": {
            "card": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
        },
        "reward_program": "0x979C9F171fb6e9BC501Aa7eEd71ca8dC27cF1185",
        "rewards_bucket": "s3://tally-production-reward-programs",
    },
}
