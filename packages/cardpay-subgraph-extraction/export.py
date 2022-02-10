from subgraph_extractor.cli import extract
import click
from cloudpathlib import AnyPath
import os
import logging
import yaml
import schedule
import time

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(
    format="%(asctime)s %(levelname)-8s %(message)s",
    level=LOGLEVEL,
    datefmt="%Y-%m-%d %H:%M:%S",
)

BLOCK_DURATION = 5


def extract_single(config, database_string, output_location):
    logging.info(f"Extraction start from {config['name']} to {output_location}")
    extract(config, database_string, output_location)
    logging.info(f"Extraction complete from {config['name']} to {output_location}")


def setup_regular_extraction(config, database_string, output_location):
    # If we find nothing else, assume at least hourly
    min_duration = 3600
    for _table, table_config in config["tables"].items():
        min_partition = min(table_config["partition_sizes"])
        min_duration = min(min_duration, (min_partition * BLOCK_DURATION) // 2)

    # Don't run more than every 10 seconds
    if min_duration < 10:
        logging.warn(
            f"Minimum duration is {min_duration} seconds for {config['name']}, which is less than 10 seconds. Setting to 10 seconds."
        )
        min_duration = 10
    logging.info(
        f"Setting regular processing every {min_duration} seconds for {config['name']}"
    )
    schedule.every(min_duration).seconds.do(
        extract_single,
        config=config,
        database_string=database_string,
        output_location=output_location,
    )


@click.command()
@click.option(
    "--subgraph-config-folder",
    help="The folder containing the subgraph config files",
    default="config",
)
@click.option(
    "--database-string",
    default=os.environ.get(
        "SE_DATABASE_STRING",
        "postgresql://graph-node:let-me-in@localhost:5432/graph-node",
    ),
    help="The database string for connections. Defaults to SE_DATABASE_STRING if set, otherwise a local graph-node",
)
@click.option(
    "--output-location",
    default=os.environ.get("SE_OUTPUT_LOCATION", "data"),
    help="The base output location, whether local or cloud. Defaults to SE_OUTPUT_LOCATION if set, otherwise a folder called data",
)
@click.option(
    "--environment",
    default=os.environ.get("ENVIRONMENT", "development"),
    help="The current environment (development, staging, production). Defaults to ENVIRONMENT if set, otherwise development",
)
def extract_all(subgraph_config_folder, database_string, output_location, environment):
    for file_name in AnyPath(subgraph_config_folder).glob("*.yaml"):
        config = yaml.safe_load(file_name.open("r"))
        if environment not in config:
            raise Exception(
                f"Environment {environment} not found in config file {file_name}, available environments are {list(config.keys())}"
            )

        setup_regular_extraction(config[environment], database_string, output_location)
    # Start by running everything when booting
    schedule.run_all()
    # Go into an infinite loop
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    extract_all()
