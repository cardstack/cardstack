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

    def set_core_parameters(self, docker_image, payment_cycle_length, start_block, end_block):
        self.docker_image = docker_image
        self.payment_cycle_length = payment_cycle_length
        self.start_block = start_block
        self.end_block = end_block

    @abstractmethod
    def set_user_defined_parameters(
        self,
    ):
        raise NotImplementedError

    @abstractmethod
    def sql(self, table_query):
        raise NotImplementedError

    def _get_table_query(self, table_name, min_partition: int, max_partition: int):
        config_location = self.subgraph_config_location[table_name]
        local_files = get_files(config_location, table_name, min_partition, max_partition)
        return f"parquet_scan({local_files})"

    def run_query(self, table_query, vars, sql=None):
        con = duckdb.connect(database=":memory:", read_only=False)
        if sql is not None:
            con.execute(sql, vars)
            return con.fetchdf()
        else:
            con.execute(self.sql(table_query), vars)
            return con.fetchdf()

    @abstractmethod
    def run(self, start_block: int, end_block: int):
        raise NotImplementedError

    @abstractmethod
    def aggregate(self):
        raise NotImplementedError

    @abstractmethod
    def df_to_payment_list(self, df, payment_cycle, reward_program_id):
        raise NotImplementedError

    @staticmethod
    def get_summary(payment_list):
        return pd.DataFrame(
            {
                "total_reward": [payment_list["amount"].sum()],
                "unique_payee": [len(pd.unique(payment_list["payee"]))],
            }
        )
