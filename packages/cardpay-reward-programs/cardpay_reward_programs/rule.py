from abc import ABC, abstractmethod

import duckdb
import pandas as pd
from cardpay_reward_programs.utils import get_files


class Rule(ABC):
    """
    A single image should run only a single rule
    """

    def __init__(self, core_parameters, user_defined_parameters):
        self.set_core_parameters(**core_parameters)
        self.set_user_defined_parameters(**user_defined_parameters)

    def set_core_parameters(self, payment_cycle_length, start_block, end_block, subgraph_config_locations):
        self.payment_cycle_length = payment_cycle_length
        self.start_block = start_block
        self.end_block = end_block
        self.subgraph_config_locations = subgraph_config_locations

    @abstractmethod
    def set_user_defined_parameters(
        self,
    ):
        raise NotImplementedError

    @abstractmethod
    def sql(self, table_query):
        raise NotImplementedError

    def _get_table_query(self, config_name, table_name, min_partition: int, max_partition: int):
        config_location = self.subgraph_config_locations[config_name]
        local_files = get_files(config_location, table_name, min_partition, max_partition)
        return f"parquet_scan({local_files})"

    def run_query(self, table_query, vars):
        con = duckdb.connect(database=":memory:", read_only=False)
        con.execute(self.sql(table_query), vars)
        return con.fetchdf()

    @abstractmethod
    def run(self, payment_cycle: int, reward_program_id: str):
        raise NotImplementedError

    @staticmethod
    def get_summary(payment_list):
        return {
                "total_reward": [payment_list["amount"].sum()],
                "unique_payee": [len(pd.unique(payment_list["payee"]))],
            }