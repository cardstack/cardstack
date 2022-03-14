import json
import os

import typer
from boto3.session import Session
from cardpay_reward_programs.rule import Rule
from cardpay_reward_programs.rules import *
from cloudpathlib import AnyPath, S3Client
from dotenv import load_dotenv

from .payment_tree import PaymentTree
from .utils import get_parameters, to_camel_case, write_parquet_file

load_dotenv()

cached_client = S3Client(
    local_cache_dir=".cache",
    boto3_session=Session(
    ),
)
cached_client.set_as_default_client()


def run_reward_program(
    rule_name: str = typer.Argument(default="MinSpend", help="Rule name"),
    parameters_file: str = typer.Argument(
        default="./input/parameters.json", help="The parameters file to use"
    ),
    output_location: str = typer.Argument(
        default="./output", help="The directory to write the results to"
    ),
):
    """
    Run a reward program as defined in the parameters file
    """
    with open(AnyPath(parameters_file), "r") as stream:
        parameters = json.load(stream)
    
    for subclass in Rule.__subclasses__():
        if subclass.__name__ == rule_name:
            rule = subclass(parameters["core"], parameters["user_defined"])
    payment_list = rule.run(parameters["run"]["payment_cycle"], parameters["run"]["reward_program_id"])
    tree = PaymentTree(payment_list.to_dict("records"))
    table = tree.as_arrow()
    write_parquet_file(AnyPath(output_location), table)


def cli():
    typer.run(run_reward_program)


if __name__ == "__main__":
    typer.run(run_reward_program)
