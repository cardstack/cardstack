import binascii
import itertools
import json
import tempfile
from pathlib import PosixPath

import duckdb
import pyarrow.dataset as ds
import pyarrow.parquet as pq
import yaml
from cachetools import TTLCache, cached
from cloudpathlib import AnyPath, CloudPath
from pyarrow import fs

from .payment_tree import decode_payment


def group_by(data_array, callback):
    # remember: itertools.groupby requires that keys are sorted; it only groups common keys which are next to each other
    sorted_data = sorted(data_array, key=callback)
    return itertools.groupby(sorted_data, callback)


def get_local_file(file_location):
    if isinstance(file_location, PosixPath):
        return file_location.as_posix()
    elif isinstance(file_location, CloudPath):
        if file_location._local.exists():
            # Our files are immutable so if the local cache exists
            # we can just return that
            return file_location._local.as_posix()
        else:
            # Otherwise this downloads the file and returns the local path
            return file_location.fspath
    else:
        raise Exception("Unsupported path type")


@cached(TTLCache(maxsize=1000, ttl=60))
def get_latest_details(config_location):
    with open(config_location / "latest.yaml", "r") as stream:
        return yaml.safe_load(stream)


def get_table_dataset(config_location, table):
    config_location = AnyPath(config_location)
    latest = get_latest_details(config_location)
    table_metadata = config_location.joinpath(
        "data",
        f"subgraph={latest['subgraph_deployment']}",
        f"table={table}",
        "_metadata",
    )
    filesystem, path = fs.FileSystem.from_uri(str(table_metadata))
    return ds.parquet_dataset(path, filesystem=filesystem)


def get_parameters(parameters):
    """
    TODO: take hex blob as input instead of parameters
    """
    core_parameters = parameters.get("core")
    user_defined_parameters = parameters.get("user_defined")
    return core_parameters, user_defined_parameters


def get_payment_cycle(start_block, end_block, payment_cycle_length):
    """
    by default, the payment cycle is the tail of the compute range
    """
    return max(end_block, start_block + payment_cycle_length)


def write_parquet_file(file_location, table):
    # Pyarrow can't take a file object so we have to write to a temp file
    # and upload directly
    if isinstance(file_location, CloudPath):
        with tempfile.TemporaryDirectory() as temp_dir:
            pq_file_location = AnyPath(temp_dir) / "results.parquet"
            pq.write_table(table, pq_file_location)
            file_location.joinpath("results.parquet").upload_from(pq_file_location)
    else:
        file_location.mkdir(parents=True, exist_ok=True)
        pq.write_table(table, file_location / "results.parquet")


def write_parameters_file(file_location, o):
    if isinstance(file_location, CloudPath):
        with tempfile.TemporaryDirectory() as temp_dir:
            parameters_file_location = AnyPath(temp_dir) / "parameters.json"
            with open(parameters_file_location, "w") as f:
                f.write(json.dumps(o))
            file_location.joinpath("parameters.json").upload_from(
                parameters_file_location
            )
    else:
        raise Exception("Should only write to s3 bucket")


def get_unclaimed_rewards(previous_output_location, claims_data_root, block):
    """Get, as Payments, the unclaimed rewards from the previous output

    Args:
        previous_output_location (str): The full path to the results.parquet file of the previous execution
        claims_data_root (str): The root of the subgraph export that contains a rewardee_claims table
        block (int): The block number to be treated as "now", for the purposes of calculating the unclaimed rewards

    Returns:
        List[Payment]: A list of Payments, one for each unclamied reward
    """
    con = duckdb.connect(":memory:")
    # Create a table that contains all claims, this is lazy and will not pull all data
    con.register(
        "rewardee_claims", get_table_dataset(claims_data_root, "rewardee_claim")
    )
    # Load the previous output, filtering on only rewards that have expired
    rewards = con.execute(
        f"select * from '{get_local_file(AnyPath(previous_output_location))}' where validTo <= ?",
        [block],
    ).df()
    # We only need to look at claims made that happened after the first one became eligible to claim
    # e.g. if the first claim became eligible to claim at block 100 (validFrom=100), we only need to
    # look at claims made after block 100, and only up to the "current" block
    first_claimable_reward_block = int(rewards["validFrom"].min())
    claimed_df = con.execute(
        "select leaf from rewardee_claims where _block_number >= ? and _block_number <= ?",
        [first_claimable_reward_block, block],
    ).df()
    # The exported data from the subgraph is a different binary structure so we need to convert it
    claimed_df["leaf"] = claimed_df["leaf"].map(
        lambda leaf: binascii.hexlify(leaf).decode()
    )
    # The unclaimed rewards are ones where the leaf is not in the list of all claimed leaves
    unclaimed_rewards = rewards[~rewards["leaf"].isin(claimed_df["leaf"])]

    # Convert these to payments
    unclaimed_payments = []
    for claim in unclaimed_rewards.to_dict(orient="records"):
        unclaimed_payments.append(decode_payment(claim["leaf"]))

    return unclaimed_payments
