import pandas as pd

default_core_config = {
    "payment_cycle_length": 32768,
    "start_block": 20000000,
    "end_block": 26000000,
}


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
