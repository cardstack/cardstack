from abc import ABC, abstractmethod

import duckdb
import pandas as pd
import pydash as py_
from cardpay_reward_programs.utils import get_unclaimed_rewards


class Rule(ABC):
    """
    A single image should run only a single rule
    """

    def __init__(
        self,
        core_parameters,
        user_defined_parameters,
    ):
        self.connection = duckdb.connect(":memory:")
        self.set_core_parameters(**core_parameters)
        self.set_user_defined_parameters(**user_defined_parameters)

    def set_core_parameters(
        self,
        payment_cycle_length,
        start_block,
        end_block,
        duration,
        subgraph_config_locations,
        rollover=False,
        docker_image=None,
    ):
        self.payment_cycle_length = payment_cycle_length
        self.start_block = start_block
        self.end_block = end_block
        self.duration = duration
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
        """This function gets the payments for a given payment cycle and reward program id.
        If the program is a rollover program, it will also get the unclaimed rewards from the previous payment cycle.

        Args:
            payment_cycle (int): The payment cycle, typically the block number of the last block in the payment cycle
            reward_program_id (str): The reward program id
            previous_output (_type_, optional): _description_. The location of the results.parquet file of the previous payment cycle. Defaults to None.
            rewards_subgraph_location (_type_, optional): _description_. The root location of the subgraph export containing rewards data, including the table rewardee_claims.
                                                                          e.g. s3://cardpay-staging-partitioned-graph-data/data/rewards/0.0.2/

        Returns:
            DataFrame: A dataframe of rewardee & reward amount
        """
        current_cycle_payments_df = self.run(payment_cycle, reward_program_id)
        # If rollover isn't set, or this is the first and there's no previous output, return the current cycle
        if not self.rollover:
            return current_cycle_payments_df
        else:
            if previous_output is None and rewards_subgraph_location is None:
                current_cycle_payments_df[
                    "explanationData"
                ] = current_cycle_payments_df.explanationData.apply(
                    lambda row: {**row, **{"rollover_amount": 0}}
                )
                return current_cycle_payments_df
            payment_list = current_cycle_payments_df.to_dict("records")
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
            combined_payments = py_.group_by(
                payment_list + unclaimed_payments,
                lambda x: (
                    x["rewardProgramID"].lower(),
                    x["payee"].lower(),
                    x["token"].lower(),
                ),
            )
            # Sum the amounts of the grouped payments
            new_payment_list = []
            for _, payments in combined_payments.items():
                # payments[0] and payments[1] will have the same general data, just differing amounts
                # that need summing
                payments = py_.sort_by(payments, "paymentCycle")
                rollover_amount = sum(p["amount"] for p in payments[1:])
                new_payment = payments[0].copy()
                new_payment["amount"] = sum([p["amount"] for p in payments])
                new_payment["explanationData"] = self.get_explanation_data(new_payment)
                new_payment["explanationData"]["rollover_amount"] = rollover_amount
                new_payment_list.append(new_payment)
            return pd.DataFrame(new_payment_list)

    @staticmethod
    def get_summary(payment_list):
        return {
            "total_reward": [payment_list["amount"].sum()],
            "unique_payee": [len(pd.unique(payment_list["payee"]))],
        }

    @abstractmethod
    def get_explanation_data(self, payment, run_parameters):
        raise NotImplementedError
