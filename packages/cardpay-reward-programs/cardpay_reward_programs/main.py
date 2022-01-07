import typer
import json
from pathlib import Path

from .programs.usage import UsageRewardProgram
from .payment_tree import PaymentTree, Payment
import pyarrow.parquet as pq

def run_reward_program(
    parameters_file: str = typer.Option(
        default="/input/parameters.json", help="The parameters file to use"
    ),
    output_location: str = typer.Option(
        default="/output", help="The directory to write the results to"
    ),
):
    """
    Run a reward program as defined in the parameters file
    """
    ## parse params file
    parameters = json.load(open(parameters_file))

    run_parameters = parameters["run"]
    core_parameters = parameters["core"]
    user_defined_parameters = parameters["user_defined"]
    program_parameters = user_defined_parameters["parameters"]

    reward_program_type = user_defined_parameters["reward_program_type"]
    if reward_program_type == "usage":
        program = UsageRewardProgram(
            core_parameters["subgraph_config_location"],
            core_parameters["reward_program_id"],
            core_parameters["payment_cycle_length"],
        )
    else:
        raise ValueError(f"Unknown reward program type: {reward_program_type}")
    program.set_parameters(**program_parameters)
    results_df = program.run(run_parameters["payment_cycle"])
    tree = PaymentTree(results_df.to_dict("records"))
    table = tree.as_arrow()
    pq.write_table(table, Path(output_location) / "results.parquet")


def cli():
    typer.run(run_reward_program)


if __name__ == "__main__":
    typer.run(run_reward_program)
