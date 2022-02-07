# Cardpay subgraph extraction

This package contains the code to extract data out of the postgres database behind the subgraph into partitioned parquet files.

## Setup

This requires python 3.9, and we recommend using miniconda to manage python versions.

    conda create --name cardpay-subgraph python=3.9
    conda activate cardpay-subgraph
    pip install -r requirements.txt

## Usage

### Creating new config files for exporting

You can use the terminal UI to create a new config file, to start this run

    subgraph_config_generator --config-location config/my_config_file_name.yaml

This will default to a local graph-node setup, but you can connect to any postgres database by using the `--database-string` option.

You will be asked a series of questions about which subgraph to use, which tables and how to partition them.
Importantly, you will need to decide if you want to remap any numeric columns otherwise they will be bytes rather than usable numbers.

Afterwards, adjust the config file to match your use case. The defaults are sane for remapped numeric values (map into uint64 if possible)
but you will need to set the _name_ of the configuration and probably adjust the partition sizes (these must be multiples). Recommended for block numbers:

    partition_sizes:
        - 524288
        - 32768
        - 1024

These correspond to roughly one month, two days, and one and a half hours of blocks on xDai respectively.

### Exporting data

To export the data for all config files on a regular schedule, run

    python export.py

You can specify the database string, config locations and the output location if required (see the `--help` for more information).
Locations can be cloud or local. It will default to a log level of INFO but can be changed with the LOGLEVEL environment variable.

This will start an infinite loop running all the config files in the config directory, each set to run twice per minimum partition size if it's partitioned on `block_number`, assuming each block takes 5s. If no duration is identified it will run once per hour.

The timing is not exact, as they will run sequentially, and it will not run faster than once per 10s.

### Releasing

You can release a new version on staging by running the following command in the root of the monorepo:

     waypoint up -app=cardpay-subg-ext -prune-retain=0

This will remove the previous deployment, build the docker image and deploy a new service.
