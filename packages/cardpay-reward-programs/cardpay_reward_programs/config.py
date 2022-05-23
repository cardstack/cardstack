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
        }
    },
    "production": {
        "tokens": {
            "card": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
        }
    },
}
