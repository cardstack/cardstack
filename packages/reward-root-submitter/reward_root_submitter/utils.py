import re

import pyarrow.parquet as pq
from cloudpathlib import AnyPath
from hexbytes import HexBytes


def get_all_reward_outputs(root: AnyPath):
    for reward_program_folder in root.iterdir():
        reward_program_id = re.search(
            r"rewardProgramID=([^/]*)", str(reward_program_folder)
        ).group(1)
        for payment_cycle_folder in reward_program_folder.iterdir():
            payment_cycle = re.search(
                r"paymentCycle=(\d*)", str(payment_cycle_folder)
            ).group(1)
            yield {
                "file": payment_cycle_folder / "results.parquet",
                "reward_program_id": reward_program_id,
                "payment_cycle": int(payment_cycle),
            }


def get_root_from_file(file: AnyPath):
    with file.open("rb") as pf:
        payment_file = pq.ParquetFile(pf)
        # Read only a single row and a single column
        try:
            file_start = next(payment_file.iter_batches(batch_size=1, columns=["root"]))
            first_row = file_start.to_pylist()[0]
            return HexBytes(first_row["root"])
        except StopIteration:
            return None
