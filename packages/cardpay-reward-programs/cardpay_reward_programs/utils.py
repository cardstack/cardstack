from os import stat
from pathlib import PosixPath
from time import time
from typing import Any

import duckdb
import yaml
from boto3.session import Session
from cloudpathlib import AnyPath, CloudPath, S3Client

cached_client = S3Client(local_cache_dir="mycache", boto3_session=Session())
cached_client.set_as_default_client()


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
