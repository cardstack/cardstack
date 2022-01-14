from subgraph_extractor.cli import extract_from_config
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


def extract_single(config_file, database_string, output_location):
    logging.info(f"Extraction start from {config_file} to {output_location}")
    extract_from_config(config_file, database_string, output_location)
    logging.info(f"Extraction complete from {config_file} to {output_location}")


def setup_regular_extraction(config_file, database_string, output_location):
    config = yaml.safe_load(config_file.open("r"))
    # If we find nothing else, assume at least hourly
    min_duration = 3600
    for table, table_config in config["tables"].items():
        if table_config["partition_column"] == "block_number":
            min_partition = min(table_config["partition_sizes"])
            min_duration = min(min_duration, (min_partition * BLOCK_DURATION) // 2)

    # Don't run more than every 10 seconds
    if min_duration < 10:
        logging.warn(
            f"Minimum duration is {min_duration} seconds for {config_file}, which is less than 10 seconds. Setting to 10 seconds."
        )
        min_duration = 10
    logging.info(
        f"Setting regular processing every {min_duration} seconds for {config_file}"
    )
    schedule.every(min_duration).seconds.do(
        extract_single,
        config_file=config_file,
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
def extract_all(subgraph_config_folder, database_string, output_location):
    for file_name in AnyPath(subgraph_config_folder).glob("*.yaml"):
        setup_regular_extraction(file_name, database_string, output_location)
    # Start by running everything when booting
    schedule.run_all()
    # Go into an infinite loop
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    extract_all()
