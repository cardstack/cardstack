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


reward_token_addresses = {
    "xdai": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
    "sokol": "0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee",
}
