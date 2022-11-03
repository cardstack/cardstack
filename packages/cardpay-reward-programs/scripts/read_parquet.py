import pandas as pd
import typer
from cloudpathlib import AnyPath
from scripts.utils import Environment


def read_parquet(
    reward_program_id: str, payment_cycle: int, env: Environment = Environment.staging
):
    path = AnyPath(
        f"s3://cardpay-{env.value}-reward-programs/rewardProgramID={reward_program_id}/paymentCycle={payment_cycle}/results.parquet"
    )
    o = pd.read_parquet(path)
    print(o)


if __name__ == "__main__":
    typer.run(read_parquet)
