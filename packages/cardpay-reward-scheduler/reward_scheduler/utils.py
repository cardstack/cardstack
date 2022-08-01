import os
from pathlib import PosixPath

import boto3
import yaml
from cachetools import TTLCache, cached
from cloudpathlib import AnyPath, CloudPath


def get_local_file(file_location):
    """
    Download files if not local & return their local path
    """
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
    with open(AnyPath(config_location) / "latest.yaml", "r") as stream:
        return yaml.safe_load(stream)


def get_partition_iterator(min_partition, max_partition, partition_sizes):
    for partition_size in sorted(partition_sizes, reverse=True):
        start_partition_allowed = (min_partition // partition_size) * partition_size
        end_partition_allowed = (max_partition // partition_size) * partition_size
        last_max_partition = None
        for start_partition in range(
            start_partition_allowed, end_partition_allowed, partition_size
        ):
            last_max_partition = start_partition + partition_size
            yield partition_size, start_partition, start_partition + partition_size
        if last_max_partition is not None:
            min_partition = last_max_partition


def get_partition_files(config_location, table, min_partition=None, max_partition=None):
    """
    Given the location of extracted subgraph data & a block range,
    get a set of non-overlapping files that cover the block range.
    """
    # Get config
    with open(get_local_file(config_location / "config.yaml"), "r") as stream:
        config = yaml.safe_load(stream)
    latest = get_latest_details(config_location)
    latest_block = latest.get("latest_block")
    if max_partition is None:
        max_partition = latest_block
    if min_partition is None:
        min_partition = latest.get("earliest_block")
    # Get table
    table_config = config["tables"][table]
    partition_sizes = sorted(table_config["partition_sizes"], reverse=True)
    table_dir = config_location.joinpath(
        "data", f"subgraph={latest['subgraph_deployment']}", f"table={table}"
    )
    files = []
    for partition_size, start_partition, end_partition in get_partition_iterator(
        min_partition, latest_block, partition_sizes
    ):
        if start_partition < max_partition:
            files.append(
                table_dir.joinpath(
                    f"partition_size={partition_size}",
                    f"start_partition={start_partition}",
                    f"end_partition={end_partition}",
                    "data.parquet",
                )
            )
    return files


def get_files(config_location, table, min_partition=None, max_partition=None):
    file_list = get_partition_files(
        AnyPath(config_location), table, min_partition, max_partition
    )
    return list(map(get_local_file, file_list))


def get_job_definition_for_image(image_name):
    """
    Find a job definition on AWS which is configured to use this image.

    Job definitions are required to launch a job on AWS Batch.
    """
    client = boto3.client("batch")
    job_definitions = client.describe_job_definitions(maxResults=100, status="ACTIVE")
    for job_definition in job_definitions["jobDefinitions"]:
        if job_definition["tags"].get("reward_rule_status") != "approved":
            continue
        if job_definition["containerProperties"]["image"] == image_name:
            return job_definition


def run_job(image_name, parameters_location, output_location, tags={}):
    client = boto3.client("batch")
    # The job definition is required to run a container
    # it defines CPU/RAM requirements etc.
    job_definition = get_job_definition_for_image(image_name)

    # Change the command we run in the docker container at start in order
    # to pass in the location of the parameters file and the location
    # the output should be written to
    container_overrides = {"command": [parameters_location, output_location]}
    if os.environ.get("ENVIRONMENT") and os.environ.get("SENTRY_DSN"):
        container_overrides["environment"] = [
            {"name": "ENVIRONMENT", "value": os.environ.get("ENVIRONMENT")},
            {"name": "SENTRY_DSN", "value": os.environ.get("SENTRY_DSN")},
        ]
    return client.submit_job(
        jobName="reward_program_run",
        jobQueue="reward_programs_batch_job_queue",
        jobDefinition=job_definition["jobDefinitionArn"],
        containerOverrides=container_overrides,
        tags={},
    )
