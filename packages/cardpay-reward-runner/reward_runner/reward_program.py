import json
import duckdb
from .utils import get_files, get_latest_details, get_job_definition_for_image, run_job
import requests
import logging
from copy import deepcopy
from cloudpathlib import AnyPath

class RewardProgram():

    processed_cycles = set()
    last_update_block = 0

    def __init__(self, result_file_root, reward_program_id, subgraph_url, subgraph_extract_location=None) -> None:
        self.reward_program_id = reward_program_id
        self.subgraph_url = subgraph_url
        self.reward_program_output_location = AnyPath(result_file_root).joinpath(
            f"rewardProgramID={reward_program_id}"
        )
        if subgraph_extract_location is not None:
            self.load_submitted_from_subgraph_extraction(subgraph_extract_location)
        self.update_processed()

    def load_submitted_from_subgraph_extraction(self, subgraph_extract_location):
        subgraph_export_files = get_files(subgraph_extract_location, "merkle_root_submission")
        con = duckdb.connect(database=":memory:", read_only=False)
        con.execute(f"""
        select distinct payment_cycle_uint64 from parquet_scan({subgraph_export_files})
        """)
        self.processed_cycles.update(r[0] for r in con.fetchall())
        con.execute(f"select max(_block_number) from parquet_scan({subgraph_export_files})")
        self.last_update_block = con.fetchall()[0][0]

    def update_processed(self):
        """
        Update the set of processed payment cycles from subgraph
        """
        # graphql check
        query = f"""query {{
            merkleRootSubmissions(orderBy:blockNumber, orderDirection:asc, 
                where:{{rewardProgram:"{self.reward_program_id}", blockNumber_gt:{self.last_update_block}}}) {{
                blockNumber
                paymentCycle
            }}
        }}"""
        try:
            r = requests.post(
                self.subgraph_url,
                json={"query": query},
            )
            if r.ok:
                json_data = r.json()
                for submission in json_data["data"]["merkleRootSubmissions"]:
                    self.processed_cycles.add(int(submission["paymentCycle"]))
                    self.last_update_block = max(self.last_update_block, int(submission["blockNumber"]))
            else:
                raise (r.raise_for_status())
        except requests.exceptions.ConnectionError:
            logging.warn("Connection error during query subgraph")
        except Exception as e:
            logging.warn("Error when querying subgraph")
            raise (e)
        pass


    def get_latest_data_block(self, rule):
        """
        Get the latest block that has data for this program
        based on the subgraph exports
        """
        latest_block = None
        for subgraph_config in rule["subgraph_config_locations"].values():
            latest_data = get_latest_details(subgraph_config)
            if latest_block is None:
                latest_block = latest_data["latest_block"]
            else:
                latest_block = min(latest_block, latest_data["latest_block"])
        return latest_block

    def is_locked(self):
        return False

    def get_processable_payment_cycles(self, rule):
        """
        Return a set of payment cycles that are valid for this program
        and have not been processed yet, but where the data is available
        """
        core_config = rule["core"]
        self.update_processed()
        start_block = core_config["start_block"]
        latest_data_block = self.get_latest_data_block(core_config)
        # If there is no data that's a dependency then
        # all cycles from the start to end block are 
        # valid to process
        if latest_data_block is None:
            end_block = core_config["end_block"]
        else:
            end_block = min(core_config["end_block"], latest_data_block)
        print(core_config, latest_data_block)
        payment_cycle_length = core_config["payment_cycle_length"]
        return set(range(start_block, end_block, payment_cycle_length)) - self.processed_cycles


    def get_rule(self):
        return {
            "core": {
                "payment_cycle_length": 1000,
                "start_block": 26636000,
                "end_block": 26640000,
                "docker_image": '680542703984.dkr.ecr.us-east-1.amazonaws.com/flat_payment:latest',
                "subgraph_config_locations": {
                    "prepaid_card": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/"
                }
            },
            "user_defined": {
                "token": "0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1",
                "duration": 518400,
                "reward_per_user": "1000000000000000000",
                "accounts": [
                "0xF93944cF3638d2089B31F07E244a11380a5D0Ff3",
                ]
            }
        }


    def run(self, payment_cycle, rule):
        print(f"Running {payment_cycle}")
        submission_data = deepcopy(rule)
        docker_image = submission_data["core"]["docker_image"]
        del submission_data["core"]["docker_image"]
        submission_data["run"] = {
            "reward_program_id": self.reward_program_id,
            "payment_cycle": payment_cycle
        }
        payment_cycle_output = self.reward_program_output_location.joinpath(
            f"paymentCycle={payment_cycle}"
        )
        parameters_location = payment_cycle_output.joinpath("parameters.json")
        with parameters_location.open('w') as params_out:
            json.dump(submission_data, params_out)
        job_definition = get_job_definition_for_image(docker_image)
        job = run_job(job_definition, parameters_location.as_uri(), payment_cycle_output.as_uri())
        return job

    def run_all(self) -> None:
        if self.is_locked():
            return
        rule = self.get_rule()
        processable_payment_cycles = self.get_processable_payment_cycles(rule)
        for payment_cycle in sorted(processable_payment_cycles):
            self.run(payment_cycle, rule)


if __name__ == "__main__":
    program = RewardProgram("s3://tally-staging-reward-programs/","0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07", "https://graph-staging-green.stack.cards/subgraphs/name/habdelra/cardpay-sokol")#, "/home/ian/projects/cardstack/packages/cardpay-subgraph-extraction/data/rewards/0.0.2")
    print(program.last_update_block, program.processed_cycles)
    print(program.get_processable_payment_cycles(program.get_rule()))
    print(program.run_all())