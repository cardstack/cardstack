from os import environ
from tempfile import TemporaryDirectory
from pathlib import Path
import shutil
import json
import boto3
import typer

import docker
client = docker.from_env()

output_dir = Path("out")


def get_max_block(program):
    return get_rule(program)['max_block']

def get_programs():
    return list(json.load(open(Path('config') / 'reward_mock.json')).keys())


def get_rule(program):
    return json.load(open(Path('config') / 'reward_mock.json'))[program]

    
def run_all(output_location:str, max_block:int=24589499):
    stsclient = boto3.client('sts')
    credentials = stsclient.get_session_token()['Credentials']

    for program in get_programs():
        rule = get_rule(program)
        print(rule)
        for payment_cycle in range(rule["core"]["valid_from"], min(rule["core"]["valid_to"], max_block), rule["core"]["payment_cycle_length"]):
            output_location = output_dir / f"rewardProgramID={rule['core']['reward_program_id']}" / f"paymentCycle={payment_cycle}"
            if not output_location.exists():
                print(f"Running program {rule['core']['reward_program_id']} for payment cycle {payment_cycle}")
                rule["run"] = {
                    "payment_cycle": payment_cycle
                }
                with TemporaryDirectory() as tmpdir:
                    config_location = Path(tmpdir) / "parameters.json"
                    with open(config_location, "w") as f:
                        json.dump(rule, f)
                    
                    print(client.containers.run(rule["core"]["docker_image"], f"run_reward_program --parameters-file /input/parameters.json --output-location /output",
                    mounts=[docker.types.Mount("/input/", tmpdir, type="bind"), docker.types.Mount("/output/", tmpdir, type="bind")],
                    environment={"AWS_ACCESS_KEY_ID": credentials['AccessKeyId'], "AWS_SECRET_ACCESS_KEY": credentials['SecretAccessKey'], "AWS_SESSION_TOKEN": credentials['SessionToken']}))
                    
        
                    shutil.copytree(tmpdir, output_dir / f"rewardProgramID={rule['core']['reward_program_id']}" / f"paymentCycle={payment_cycle}")

if __name__ == "__main__":
    typer.run(run_all)