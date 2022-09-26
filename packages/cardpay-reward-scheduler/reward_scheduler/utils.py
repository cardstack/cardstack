import os

import boto3
import pyarrow.dataset as ds
import yaml
from cachetools import TTLCache, cached
from cloudpathlib import AnyPath
from pyarrow import fs


@cached(TTLCache(maxsize=1000, ttl=60))
def get_latest_details(config_location):
    with open(AnyPath(config_location) / "latest.yaml", "r") as stream:
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
