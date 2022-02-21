"""
# Reward Usage

This is designed to reward users using any part of the cardpay network
"""

import duckdb
import pandas as pd

from ..utils import get_files


class Program:
    def __init__(self, config_location, reward_program_id: str, payment_cycle_length: int):
        self.config_location = config_location
        self.reward_program_id = reward_program_id
        self.payment_cycle_length = payment_cycle_length


class UsageRewardProgram(Program):
    def __init__(self, config_location, reward_program_id, payment_cycle_length):
        super(UsageRewardProgram, self).__init__(
            config_location, reward_program_id, payment_cycle_length
        )

    def set_parameters(
        self,
        token: str,
        base_reward: float,
        transaction_factor: float,
        spend_factor: float,
        valid_duration: int,
    ):
        self.token = token
        self.base_reward = base_reward
        self.transaction_factor = transaction_factor
        self.spend_factor = spend_factor
        self.valid_duration = valid_duration

    def _get_table_query(self, min_partition: int, max_partition: int):
        table = "prepaid_card_payment"
        local_files = get_files(self.config_location, table, min_partition, max_partition)
        return f"parquet_scan({local_files})"

    def run_query(
        self,
        table_query: str,
        min_partition: int,
        max_partition: int,
        payment_cycle: int,
    ):
        valid_from = max_partition
        valid_to = max_partition + self.valid_duration
        con = duckdb.connect(database=":memory:", read_only=False)
        if table_query == "parquet_scan([])":
            print("Warning: no parquet files were found")
            column_names = [
                "payee",
                "amount",
                "transactions",
                "total_spent",
                "rewardProgramID",
                "paymentCycle",
                "token",
                "validFrom",
                "validTo",
            ]
            return pd.DataFrame(columns=column_names)
        else:
            sql = f"""
            select
            prepaid_card_owner as payee,

            (? *
            1 + (1-(percent_rank() over (order by sum(spend_amount_uint64)  desc))) * (?)
            *
            1 + (1-(percent_rank() over (order by count(*)  desc))) * (?))::integer as amount,

            count(*) as transactions,
            sum(spend_amount_uint64) as total_spent,

            ? as "rewardProgramID",
            ?::integer as "paymentCycle",
            ? as token,
            ?::integer as "validFrom",
            ?::integer as "validTo"

            from {table_query}
            where block_number_uint64 >= ? and block_number_uint64 < ?
            group by prepaid_card_owner
            order by transactions desc
            """
            con.execute(
                sql,
                [
                    self.base_reward,
                    self.spend_factor,
                    self.transaction_factor,
                    self.reward_program_id,
                    payment_cycle,
                    self.token,
                    valid_from,
                    valid_to,
                    min_partition,
                    max_partition,
                ],
            )
            return con.fetchdf()

    def run(self, payment_cycle: int):
        min_block = payment_cycle - self.payment_cycle_length
        max_block = payment_cycle
        return self.run_query(
            self._get_table_query(min_block, max_block),
            min_block,
            max_block,
            payment_cycle,
        )

    def run_n(self, start_payment_cycle: int, end_payment_cycle: int):
        payments = []
        min_block = start_payment_cycle
        max_block = end_payment_cycle
        for i in range(min_block, max_block, self.payment_cycle_length):
            df = self.run(i)
            payments.append({"block": i, "amount": df["amount"].sum()})
        return payments
