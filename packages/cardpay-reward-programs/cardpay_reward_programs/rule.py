import json
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

    def set_core_parameters(
        self, subgraph_config_location, payment_cycle_length, valid_from, valid_to, token
    ):
        self.subgraph_config_location = subgraph_config_location
        self.payment_cycle_length = payment_cycle_length
        self.valid_from = valid_from
        self.valid_to = valid_to
        self.token = token

    @abstractmethod
    def set_user_defined_parameters(
        self,
    ):
        raise NotImplementedError

    @abstractmethod
    def sql(self, min_block, max_block):
        raise NotImplementedError

    def _get_table_query(self, table_name, min_partition: int, max_partition: int):
        """
        note: have to create this bcos table names can't be passed as var to execute
        """
        local_files = get_files(
            self.subgraph_config_location, table_name, min_partition, max_partition
        )
        return f"parquet_scan({local_files})"

    def run_query(self, min_block, max_block, vars):
        con = duckdb.connect(database=":memory:", read_only=False)
        con.execute(self.sql(min_block, max_block), vars)
        return con.fetchdf()

    @abstractmethod
    def run(self, payment_cycle: int):
        raise NotImplementedError

    @abstractmethod
    def aggregate(self):
        raise NotImplementedError

    @abstractmethod
    def df_to_payment_list(self, df):
        raise NotImplementedError

    @staticmethod
    def get_summary(payment_list):
        return pd.DataFrame(
            {
                "total_reward": [payment_list["amount"].sum()],
                "unique_payee": [len(pd.unique(payment_list["payee"]))],
            }
        )
