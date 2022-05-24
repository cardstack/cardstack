import json
import duckdb
from .utils import get_files, get_latest_details, get_job_definition_for_image, run_job
import requests
import logging
from copy import deepcopy
from cloudpathlib import AnyPath


class RewardProgram:

    processed_cycles = set()
    last_update_block = 0

    def __init__(
        self,
        reward_program_id,
        w3,
        reward_manager_address,
        subgraph_url,
        result_file_root,
        subgraph_extract_location=None,
    ) -> None:
        self.w3 = w3
        with open(f"abis/RewardManager.json") as contract_file:
            contract = json.load(contract_file)
        self.reward_manager = self.w3.eth.contract(
            address=reward_manager_address, abi=contract["abi"]
        )
        self.reward_program_id = reward_program_id
        self.subgraph_url = subgraph_url
        self.reward_program_output_location = AnyPath(result_file_root).joinpath(
            f"rewardProgramID={reward_program_id}"
        )
        if subgraph_extract_location is not None:
            self.load_submitted_from_subgraph_extraction(subgraph_extract_location)
        self.update_processed()

    def load_submitted_from_subgraph_extraction(self, subgraph_extract_location):
        logging.info(
            f"Loading processed payment cycles for {self.reward_program_id} from {subgraph_extract_location}"
        )
        subgraph_export_files = get_files(
            subgraph_extract_location, "merkle_root_submission"
        )
        con = duckdb.connect(database=":memory:", read_only=False)
        con.execute(
            f"""
        select distinct payment_cycle_uint64 from parquet_scan({subgraph_export_files})
        """
        )
        self.processed_cycles.update(r[0] for r in con.fetchall())
        con.execute(
            f"select max(_block_number) from parquet_scan({subgraph_export_files})"
        )
        self.last_update_block = con.fetchall()[0][0]

    def update_processed(self):
        """
        Update the set of processed payment cycles from subgraph
        """
        logging.info(
            f"Updating processed payment cycles for {self.reward_program_id} from subgraph"
        )
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
                    self.last_update_block = max(
                        self.last_update_block, int(submission["blockNumber"])
                    )
            else:
                raise (r.raise_for_status())
        except requests.exceptions.ConnectionError:
            logging.warn("Connection error during query subgraph")
        except Exception as e:
            logging.warn("Error when querying subgraph")
            raise (e)

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
        return self.reward_manager.caller.rewardProgramLocked(self.reward_program_id)

    def get_all_payment_cycles(self, rule):
        """
        Return a set of payment cycles that are valid for this program
        where the data is available
        """
        core_config = rule["core"]
        self.update_processed()
        start_block = core_config["start_block"]
        latest_data_block = self.get_latest_data_block(core_config)
        # If there is no dependency on data then all cycles from the start
        # to end block are valid to process
        if latest_data_block is None:
            end_block = core_config["end_block"]
        else:
            end_block = min(core_config["end_block"], latest_data_block)
        payment_cycle_length = core_config["payment_cycle_length"]
        return set(range(start_block, end_block, payment_cycle_length))

    def get_rules(self):
        rule_blob = json.loads(self.reward_manager.caller.rule(self.reward_program_id))
        if type(rule_blob) == list:
            yield from rule_blob
        else:
            yield rule_blob
        return

    def raise_on_payment_cycle_overlap(self, rules):
        """
        Given a list of rules, raise an exception if there are overlapping
        payment cycles.

        For example, with two rules
        1. A rule that starts on block 0, ends on block 200 and runs every 10 blocks
        2. A rule that starts on block 20, ends on block 70 and runs every 20 blocks

        There would be a clash for payment cycles 20, 40, 60
        """
        current_cycles = set()
        for rule in rules:
            rule_cycles = self.get_all_payment_cycles(rule)
            if rule_cycles.intersection(current_cycles):
                raise Exception(
                    f"Reward program {self.reward_program_id} has overlapping payment cycles {rule_cycles.intersection(current_cycles)}"
                )
            current_cycles.update(rule_cycles)

    def run(self, payment_cycle, rule):
        """
        Trigger a job in AWS batch for a single payment cycle and single rule
        """
        logging.info(f"Running {payment_cycle} for {self.reward_program_id}")
        submission_data = deepcopy(rule)
        docker_image = submission_data["core"]["docker_image"]
        del submission_data["core"]["docker_image"]
        submission_data["run"] = {
            "reward_program_id": self.reward_program_id,
            "payment_cycle": payment_cycle,
        }
        payment_cycle_output = self.reward_program_output_location.joinpath(
            f"paymentCycle={payment_cycle}"
        )
        parameters_location = payment_cycle_output.joinpath("parameters.json")
        with parameters_location.open("w") as params_out:
            json.dump(submission_data, params_out)
        job_definition = get_job_definition_for_image(docker_image)
        job = run_job(
            job_definition, parameters_location.as_uri(), payment_cycle_output.as_uri()
        )
        return job

    def run_all(self) -> None:
        """
        Run all rules for all payment cycles that can be processed at this time
        """
        logging.info(f"Running all for {self.reward_program_id}")
        if self.is_locked():
            logging.info(f"Reward program {self.reward_program_id} is locked, skipping")
            return
        rules = list(self.get_rules())
        self.raise_on_payment_cycle_overlap(rules)
        for rule in rules:
            processable_payment_cycles = (
                self.get_all_payment_cycles(rule) - self.processed_cycles
            )
            for payment_cycle in sorted(processable_payment_cycles):
                self.run(payment_cycle, rule)
