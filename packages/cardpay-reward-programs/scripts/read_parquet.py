import pandas as pd
import typer
from cloudpathlib import AnyPath


def read_parquet(reward_program_id: str, payment_cycle: int):
    path = AnyPath(
        f"s3://cardpay-staging-reward-programs/rewardProgramID={reward_program_id}/paymentCycle={payment_cycle}/results.parquet"
    )
    o = pd.read_parquet(path)
    print(o)


if __name__ == "__main__":
    typer.run(read_parquet)
