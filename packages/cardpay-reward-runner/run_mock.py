import json
import shutil
from os import environ
from tempfile import TemporaryDirectory
from typing import Any

import boto3
import docker
import typer
from cloudpathlib import AnyPath, CloudPath

client = docker.from_env()


def get_max_block(program):
    return get_rule(program)["max_block"]


def get_programs():
    return list(json.load(open(AnyPath("config") / "reward_mock.json")).keys())


def get_rule(program):
    return json.load(open(AnyPath("config") / "reward_mock.json"))[program]


def get_access_credentials():
    session = boto3.Session()
    credentials = session.get_credentials()
    frozen_credentials = credentials.get_frozen_credentials()
    if frozen_credentials.token:
        return {
            "AWS_ACCESS_KEY_ID": frozen_credentials.access_key,
            "AWS_SECRET_ACCESS_KEY": frozen_credentials.secret_key,
            "AWS_SESSION_TOKEN": frozen_credentials.token,
        }
    else:
        stsclient = boto3.client("sts")
        credentials = stsclient.get_session_token()["Credentials"]
        return {
            "AWS_ACCESS_KEY_ID": credentials["AccessKeyId"],
            "AWS_SECRET_ACCESS_KEY": credentials["SecretAccessKey"],
            "AWS_SESSION_TOKEN": credentials["SessionToken"],
        }


def run_all(output_location: str, max_block: int = 24589499):
    output_location = AnyPath(output_location)
    for program in get_programs():
        rule = get_rule(program)
        for payment_cycle in range(
            rule["core"]["valid_from"],
            min(rule["core"]["valid_to"], max_block),
            rule["core"]["payment_cycle_length"],
        ):
            cycle_output_location = (
                output_location
                / f"rewardProgramID={rule['core']['reward_program_id']}"
                / f"paymentCycle={payment_cycle}"
            )
            if not cycle_output_location.exists():
                print(
                    f"Running program {rule['core']['reward_program_id']} for payment cycle {payment_cycle}"
                )
                rule["run"] = {"payment_cycle": payment_cycle}
                with TemporaryDirectory() as tmpdir:
                    tmpdir_path = AnyPath(tmpdir)
                    config_location = tmpdir_path / "parameters.json"
                    with open(config_location, "w") as f:
                        json.dump(rule, f)

                    print(
                        client.containers.run(
                            rule["core"]["docker_image"],
                            f"run_reward_program --parameters-file /input/parameters.json --output-location /output",
                            mounts=[
                                docker.types.Mount("/input/", tmpdir, type="bind"),
                                docker.types.Mount("/output/", tmpdir, type="bind"),
                            ],
                            environment=get_access_credentials(),
                        )
                    )
                    if isinstance(cycle_output_location, CloudPath):
                        cycle_output_location.upload_from(tmpdir_path)
                    else:
                        shutil.copytree(tmpdir, cycle_output_location)


if __name__ == "__main__":
    typer.run(run_all)
