from os import environ
from tempfile import TemporaryDirectory
from pathlib import Path
import shutil
import json
import boto3

import docker
client = docker.from_env()

output_dir = Path("out")

## PUT MIN INTO THE RULES
## PUT MAX INTO... something - input var?

min_payment_cycle = 18500000
max_payment_cycle = 19100000

def get_programs():
    return list(json.load(open(Path('config') / 'reward_mock.json')).keys())


def get_rule(program):
    return json.load(open(Path('config') / 'reward_mock.json'))[program]

    

stsclient = boto3.client('sts')
credentials = stsclient.get_session_token()['Credentials']

for program in get_programs():
    rule = get_rule(program)
    print(rule)
    for payment_cycle in range(min_payment_cycle, max_payment_cycle, rule["core"]["payment_cycle_length"]):
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
                
                print(client.containers.run("rewardprogs", f"run_reward_program --parameters-file /input/parameters.json --output-location /output",
                mounts=[docker.types.Mount("/input/", tmpdir, type="bind"), docker.types.Mount("/output/", tmpdir, type="bind")],
                environment={"AWS_ACCESS_KEY_ID": credentials['AccessKeyId'], "AWS_SECRET_ACCESS_KEY": credentials['SecretAccessKey'], "AWS_SESSION_TOKEN": credentials['SessionToken']}))
                
    
                shutil.copytree(tmpdir, output_dir / f"rewardProgramID={rule['core']['reward_program_id']}" / f"paymentCycle={payment_cycle}")
