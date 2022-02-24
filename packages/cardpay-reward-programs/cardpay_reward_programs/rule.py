from abc import ABC, abstractmethod

import duckdb
from cardpay_reward_programs.config import default_config
from cardpay_reward_programs.utils import get_files


class Rule(ABC):
    def __init__(self, **kwargs):
        """
        generic way to specify parameters of a rule
        """
        default_attr = default_config.copy()
        custom_attr = []
        allowed_attr = list(default_attr.keys()) + custom_attr
        default_attr.update(kwargs)
        self.__dict__.update((k, v) for k, v in default_attr.items() if k in allowed_attr)

    def name(self):
        return self.__class__.__name__

    @property
    @abstractmethod
    def required_rule_parameters(self):
        raise NotImplementedError

    def _get_table_query(self, min_partition: int, max_partition: int):
        """
        get table to look at
        """
        table = "prepaid_card_payment"
        local_files = get_files(self.config_location, table, min_partition, max_partition)
        return f"parquet_scan({local_files})"

    @abstractmethod
    def sql(self):
        """
        all vars should be gotten from class/object variables
        """
        raise NotImplementedError

    def run_query(self, **vars):
        con = duckdb.connect(database=":memory:", read_only=False)
        con.execute(self.sql(), **vars)
