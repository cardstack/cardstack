from abc import ABC, abstractmethod

import duckdb
import pandas as pd
from cardpay_reward_programs.utils import get_files, get_unclaimed_rewards, group_by


class Rule(ABC):
    """
    A single image should run only a single rule
    """

    def __init__(self, core_parameters, user_defined_parameters):
        self.set_core_parameters(**core_parameters)
        self.set_user_defined_parameters(**user_defined_parameters)

    def set_core_parameters(
        self,
        payment_cycle_length,
        start_block,
        end_block,
        subgraph_config_locations,
        docker_image=None,
        rollover=False,
    ):
        self.payment_cycle_length = payment_cycle_length
        self.start_block = start_block
        self.end_block = end_block
        self.subgraph_config_locations = subgraph_config_locations
        self.rollover = rollover

    @abstractmethod
    def set_user_defined_parameters(
        self,
    ):
        raise NotImplementedError

    @abstractmethod
    def sql(self, table_query, aux_table_query=None):
        raise NotImplementedError

    def _get_table_query(
        self, config_name, table_name, min_partition: int, max_partition: int
    ):
        config_location = self.subgraph_config_locations[config_name]
        local_files = get_files(
            config_location, table_name, min_partition, max_partition
        )
        return f"parquet_scan({local_files})"

    def run_query(self, table_query, vars, aux_table_query=None):
        con = duckdb.connect(database=":memory:", read_only=False)
        if aux_table_query is None:
            con.execute(self.sql(table_query), vars)
        else:
            con.execute(self.sql(table_query, aux_table_query), vars)
        return con.fetchdf()

    @abstractmethod
    def run(self, payment_cycle: int, reward_program_id: str):
        raise NotImplementedError

    def get_payments(
        self,
        payment_cycle: int,
        reward_program_id: str,
        previous_output=None,
        rewards_subgraph_location=None,
    ):
        current_cycle = self.run(payment_cycle, reward_program_id)
        # If rollover isn't set, or this is the first and there's no previous output, return the current cycle
        if not self.rollover or (
            previous_output is None and rewards_subgraph_location is None
        ):
            return current_cycle
        else:
            payment_list = current_cycle.to_dict("records")
            unclaimed_payments = get_unclaimed_rewards(
                previous_output_location=previous_output,
                claims_data_root=rewards_subgraph_location,
                block=payment_cycle,
            )
            # Update the cycle and validity range of the unclaimed payments
            for payment in unclaimed_payments:
                payment["paymentCycle"] = payment_cycle
                payment["validFrom"] = payment_cycle
                payment["validTo"] = payment_cycle + self.duration
            # Group payments of the same token and user together
            combined_payments = group_by(
                payment_list + unclaimed_payments,
                lambda x: (
                    x["rewardProgramID"].lower(),
                    x["payee"].lower(),
                    x["token"].lower(),
                ),
            )
            # Sum the amounts of the grouped payments
            new_payment_list = []
            for _, payments in combined_payments:
                # payments[0] and payments[1] will have the same general data, just differing amounts
                # that need summing
                payments = list(payments)
                payments[0]["amount"] = sum([p["amount"] for p in payments])
                new_payment_list.append(payments[0])
            return pd.DataFrame(new_payment_list)

    @staticmethod
    def get_summary(payment_list):
        return {
            "total_reward": [payment_list["amount"].sum()],
            "unique_payee": [len(pd.unique(payment_list["payee"]))],
        }
