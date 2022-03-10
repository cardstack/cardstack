import os
import tempfile
from pathlib import PosixPath

import pyarrow.parquet as pq
import yaml
from cloudpathlib import AnyPath, CloudPath


def exists(file_location):
    # Checks if we already have the file in our local cache
    # as our files are immutable we don't need to check remotely
    if isinstance(file_location, CloudPath):
        if file_location._local.exists():
            return True
    return file_location.exists()


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


def get_partition_files(config_location, table, min_partition, max_partition):
    # Get config
    with open(get_local_file(config_location / "config.yaml"), "r") as stream:
        config = yaml.safe_load(stream)
    with open(config_location / "latest.yaml", "r") as stream:
        latest = yaml.safe_load(stream)
    # Get table
    table_config = config["tables"][table]
    partition_sizes = sorted(table_config["partition_sizes"], reverse=True)
    table_dir = config_location.joinpath(
        "data", f"subgraph={latest['subgraph_deployment']}", f"table={table}"
    )
    files = []
    # First required file is the floor
    start_partition = (min_partition // partition_sizes[0]) * partition_sizes[0]
    for partition_size in partition_sizes:
        end_partition = start_partition + partition_size
        file_location = table_dir.joinpath(
            f"partition_size={partition_size}",
            f"start_partition={start_partition}",
            f"end_partition={end_partition}",
            "data.parquet",
        )
        while exists(file_location):
            files.append(file_location)
            start_partition = end_partition
            end_partition += partition_size
            file_location = table_dir.joinpath(
                f"partition_size={partition_size}",
                f"start_partition={start_partition}",
                f"end_partition={end_partition}",
                "data.parquet",
            )
            if start_partition > max_partition:
                break
    return files


def get_files(config_location, table, min_partition, max_partition):
    file_list = get_partition_files(AnyPath(config_location), table, min_partition, max_partition)
    return list(map(get_local_file, file_list))


def get_parameters(parameters):
    """
    TODO: take hex blob as input instead of parameters
    """
    core_parameters = parameters.get("core")
    user_defined_parameters = parameters.get("user_defined")
    return core_parameters, user_defined_parameters


def to_camel_case(snake_str):
    return "".join(word.title() for word in snake_str.split("_"))


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
            pq_file_location = AnyPath(temp_dir).joinpath("data.parquet")
            pq.write_table(table, pq_file_location)
            file_location.joinpath("data.parquet").upload_from(pq_file_location)
    else:
        pq.write_table(table, file_location / "results.parquet")


def bytes_to_int(b):
    return int.from_bytes(b, byteorder="big", signed=False)


def check_env():
    for expected_env in [
        "APP",
        "ETHEREUM_NODE_URL",
    ]:
        if expected_env not in os.environ:
            raise ValueError(f"Missing environment variable {expected_env}")


def create_w3():
    provider = Web3.HTTPProvider(os.environ.get("ETHEREUM_NODE_URL"))
    return Web3(provider)
