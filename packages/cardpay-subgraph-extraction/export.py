from subgraph_extractor.cli import extract_from_config
import click
from cloudpathlib import AnyPath

@click.command()
@click.option(
    "--subgraph-config-folder",
    help="The folder containing the subgraph config files",
    default='config',
)
@click.option(
    "--database-string",
    default="postgresql://graph-node:let-me-in@localhost:5432/graph-node",
    help="The database string for connections, defaults to a local graph-node",
)
@click.option(
    "--output-location",
    default="data",
    help="The base output location, whether local or cloud",
)
def export(subgraph_config_folder, database_string, output_location):
    for file_name in AnyPath(subgraph_config_folder).glob('*.yaml'):
        extract_from_config(
            file_name,
            database_string,
            output_location
        )

if __name__ == "__main__":
    export()