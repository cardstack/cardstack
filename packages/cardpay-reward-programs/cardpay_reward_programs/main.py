import json
from pathlib import Path

import pyarrow.parquet as pq
import typer
from cardpay_reward_programs.rules import *

from .payment_tree import PaymentTree


def run_reward_program(
    reward_program_id: str,
    payment_cycle: int,
    parameters_file: str = typer.Option(
        default="./input/parameters.json", help="The parameters file to use"
    ),
    output_location: str = typer.Option(
        default="./output", help="The directory to write the results to"
    ),
):
    """
    Run a reward program as defined in the parameters file
    """

    parameters = json.load(open(parameters_file))

    run_parameters = parameters["run"]
    name, core_parameters, user_defined_parameters = get_parameters(parameters)
    rule = select_rule(name, core_parameters, user_defined_parameters)

    results_df = rule.run(run_parameters["payment_cycle"])
    payment_list = rule.df_to_payment_list(results_df, reward_program_id)
    tree = PaymentTree(payment_list.to_dict("records"), payment_cycle)
    table = tree.as_arrow(payment_cycle)
    pq.write_table(table, Path(output_location) / "results.parquet")


def get_parameters(parameters):
    core_parameters = parameters.get("core")
    user_defined_parameters = parameters.get("user_defined")
    name = parameters.get("name")
    return name, core_parameters, user_defined_parameters


def select_rule(name, core_parameters, user_defined_parameters):
    rule_constructor = globals()[name]
    instance = rule_constructor(core_parameters, user_defined_parameters)
    return instance


def cli():
    typer.run(run_reward_program)


if __name__ == "__main__":
    typer.run(run_reward_program)
