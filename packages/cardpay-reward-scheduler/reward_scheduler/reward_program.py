import json
import logging
from copy import deepcopy

import duckdb
import requests
from cloudpathlib import AnyPath
from did_resolver import Resolver
from python_did_resolver import get_resolver

from .utils import get_latest_written_block, get_table_dataset, run_job


class RewardProgram:

    processed_cycles = set()
    last_update_block = 0

    def __init__(
        self,
        reward_program_id,
        reward_manager,
        subgraph_url,
        result_file_root,
        subgraph_extract_location,
    ) -> None:
        self.reward_manager = reward_manager
        self.reward_program_id = reward_program_id
        self.subgraph_url = subgraph_url
        self.reward_program_output_location = AnyPath(result_file_root).joinpath(
            f"rewardProgramID={reward_program_id}"
        )
        self.subgraph_extract_location = subgraph_extract_location
        self.load_submitted_from_subgraph_extraction()

    def load_submitted_from_subgraph_extraction(self):
        logging.info(
            f"Loading processed payment cycles for {self.reward_program_id} from {self.subgraph_extract_location}"
        )
        submission_dataset = get_table_dataset(
            self.subgraph_extract_location, "merkle_root_submission"
        )
        con = duckdb.connect(database=":memory:", read_only=False)
        con.register("submissions", submission_dataset)
        con.execute(
            "select distinct payment_cycle_uint64 from submissions where reward_program = $1",
            [self.reward_program_id],
        )
        self.processed_cycles.update(r[0] for r in con.fetchall())
        con.execute("select max(_block_number), count(*) from submissions")  # 27310514
        last_update_block, total_payment_cycles = con.fetchall()[0]
        logging.info(f"Last update block in parquet files {last_update_block}")
        if total_payment_cycles == 0:
            # There are no payment cycles in the parquet files
            self.last_update_block = 0
        else:
            self.last_update_block = last_update_block

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
        data_dependencies = list(rule["subgraph_config_locations"].values())
        # In the case of rollover, we also need to check the claims submissions
        # data is up to date
        if rule.get("rollover"):
            data_dependencies.append(self.subgraph_extract_location)
        if len(data_dependencies) > 0:
            return get_latest_written_block(data_dependencies)
        else:
            return None

    def is_locked(self):
        return self.reward_manager.caller.rewardProgramLocked(self.reward_program_id)

    def get_all_payment_cycles(self, rule):
        """
        Return a set of payment cycles that are valid for this program
        where the data is available
        """
        core_config = rule["core"]
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
        blob = self.reward_manager.caller.rule(self.reward_program_id)
        if blob and blob != b"":
            try:
                did = blob.decode("utf-8")  # new blob format: hex encodes a did string
                doc = resolve_did(did)
                rules = doc.get("tasks", [])
                if rules is None:
                    raise Exception("No rules specified")
                else:
                    return rules
            except Exception:
                # old blob format: our rule blobs were hex encoded json
                # try..except maintains backward compatibality with our old blob format
                # TODO: remove code once all reward programs have the old rule /blob removed
                rules = json.loads(blob)
            if type(rules) == list:
                return rules
            else:
                return [rules]
        else:
            return []

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

    def run_payment_cycle(
        self,
        payment_cycle,
        rule,
        previous_cycle=None,
    ):
        """
        Trigger a job in AWS batch for a single payment cycle and single rule
        """
        logging.info(f"Running {payment_cycle} for {self.reward_program_id}")
        submission_data = deepcopy(rule)
        docker_image = submission_data["core"]["docker_image"]
        submission_data["run"] = {
            "reward_program_id": self.reward_program_id,
            "payment_cycle": payment_cycle,
        }

        if previous_cycle:
            submission_data["run"].update(
                {
                    "previous_output": self.reward_program_output_location.joinpath(
                        f"paymentCycle={previous_cycle}", "results.parquet"
                    ).as_uri(),
                    "rewards_subgraph_location": str(self.subgraph_extract_location),
                }
            )

        payment_cycle_output = self.reward_program_output_location.joinpath(
            f"paymentCycle={payment_cycle}"
        )

        if payment_cycle_output.joinpath("results.parquet").exists():
            logging.info(
                f"Already processed: {payment_cycle} for {self.reward_program_id}"
            )
            return None

        # We can't pass much data directly in AWS batch, so write the
        # parameters we want to use to S3 and pass the location into the task
        parameters_location = payment_cycle_output.joinpath("parameters.json")
        payment_cycle_output.mkdir(parents=True, exist_ok=True)
        with parameters_location.open("w") as params_out:
            json.dump(submission_data, params_out)
        job = run_job(
            docker_image,
            parameters_location.as_uri(),
            payment_cycle_output.as_uri(),
            tags={
                "reward_program_id": self.reward_program_id,
                "payment_cycle": payment_cycle,
            },
        )
        return job

    def run_rule(self, rule) -> None:
        processable_payment_cycles = (
            self.get_all_payment_cycles(rule) - self.processed_cycles
        )
        for payment_cycle in sorted(processable_payment_cycles):
            if rule["core"].get("rollover"):
                previous_cycle = payment_cycle - rule["core"]["payment_cycle_length"]
                if payment_cycle == rule["core"]["start_block"]:
                    # There can't be any previous ones for the first cycle
                    self.run_payment_cycle(payment_cycle, rule)
                elif previous_cycle in self.processed_cycles:
                    # Only run if the previous cycle has been processed
                    # because the output of the previous cycle is needed
                    self.run_payment_cycle(payment_cycle, rule, previous_cycle)
                else:
                    # There's nothing to do here as the previous cycle hasn't been processed
                    pass

            else:
                self.run_payment_cycle(payment_cycle, rule)

    def run_all_rules(self) -> None:
        """
        Run all rules for all payment cycles that can be processed at this time
        """
        logging.info(f"Running all for {self.reward_program_id}")
        if self.is_locked():
            logging.info(f"Reward program {self.reward_program_id} is locked, skipping")
            return

        self.update_processed()
        rules = self.get_rules()
        logging.info(f"Reward program {self.reward_program_id} has {len(rules)} rules")
        self.raise_on_payment_cycle_overlap(rules)
        for rule in rules:
            self.run_rule(rule)

        logging.info(f"All new payment cycles triggered for {self.reward_program_id}")


def resolve_did(did: str):
    url = Resolver(get_resolver()).resolve(did)["didDocument"]["alsoKnownAs"][0]
    return requests.get(url).json()
