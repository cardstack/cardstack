from abc import ABC, abstractmethod

import duckdb
import pandas as pd
from cardpay_reward_programs.rule import Rule
from cardpay_reward_programs.utils import get_files

# type(Module()).__name__


class UsageRewardProgram(Rule):
    """
    This is designed to reward users using any part of the cardpay network
    """

    def __init__(self, **kwargs):
        super(UsageRewardProgram, self).__init__(kwargs)


class UsageRewardProgram2(Rule):
    def __init__(self, config_location, payment_cycle_length):
        super(UsageRewardProgram2, self).__init__(config_location, payment_cycle_length)

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

        # this is probably what is causing the empty dfs
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

    def test_run_query(
        self,
        table_query: str,
        min_partition: int,
        max_partition: int,
        payment_cycle: int,
    ):
        valid_from = max_partition
        valid_to = max_partition + self.valid_duration
        con = duckdb.connect(database=":memory:", read_only=False)
        dat = self.test_get_data()
        dat2 = self.test_reward_data()
        return dat

    def test_run(self, payment_cycle: int):
        min_block = payment_cycle - self.payment_cycle_length
        max_block = payment_cycle
        return self.test_run_query(
            self._get_table_query(min_block, max_block),
            min_block,
            max_block,
            payment_cycle,
        )

    def test_get_data(self):
        con = duckdb.connect(database=":memory:", read_only=False)
        sql_cols = f"""select *
        from parquet_scan(['mycache/cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1/data/subgraph=QmR4zkVGxHYVKi2TJoN8Xxni3RNgQ2Vs2Tw4booFgLUWdt/table=prepaid_card_payment/partition_size=524288/start_partition=24117248/end_partition=24641536/data.parquet'])"""
        return con.execute(sql_cols).fetch_df()

    def test_reward_data(self):
        con = duckdb.connect(database=":memory:", read_only=False)
        sql = f"""select 
            prepaid_card_owner as payee,
            count(*) as transactions,
            sum(spend_amount_uint64) as total_spent


         from parquet_scan(['mycache/cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1/data/subgraph=QmR4zkVGxHYVKi2TJoN8Xxni3RNgQ2Vs2Tw4booFgLUWdt/table=prepaid_card_payment/partition_size=524288/start_partition=24117248/end_partition=24641536/data.parquet'])
         group by payee
         order by transactions desc
         """

        sql = f"""select
           spend_amount_uint64,
           prepaid_card_owner,
           sum(spend_amount_uint64) over (partition by prepaid_card_owner) as total_spend,
           percent_rank() over (partition by prepaid_card_owner order by spend_amount_uint64)

         from parquet_scan(['mycache/cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1/data/subgraph=QmR4zkVGxHYVKi2TJoN8Xxni3RNgQ2Vs2Tw4booFgLUWdt/table=prepaid_card_payment/partition_size=524288/start_partition=24117248/end_partition=24641536/data.parquet'])
         """
        return con.execute(
            sql
            # sql, [self.base_reward, self.spend_factor, self.transaction_factor]
        ).fetch_df()
