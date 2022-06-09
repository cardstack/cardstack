import pandas as pd
import duckdb

from cardpay_reward_programs.rules import dummy_rule

def create_rule(
    monkeypatch, fake_data, core_config_overrides={}, user_config_overrides={}
):

    core_config = {
        "start_block": 17265697,
        "end_block":  21986688,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            "spend_accumulation": "s3://tall-data-dev/paulin/spend_accumulation/0.0.1/",
            "safe_owner": "s3://tall-data-dev/paulin/safe_owner/0.0.1/"  
        }
    }
    core_config.update(core_config_overrides)
    user_config = {
        "token": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
        "base_reward": 5000000000000000000,
        "transaction_factor": 2,
        "spend_factor": 2,
        "duration": 43200
    }

    user_config.update(user_config_overrides)
    con = duckdb.connect(database=":memory:", read_only=False)
    con.execute("create table TEST_TABLE as select * from fake_data")

    def table_query(
        self, config_name, table_name, min_partition: int, max_partition: int
    ):
        return "TEST_TABLE"

    def run_query(self, table_query, vars):
        con.execute(self.sql("TEST_TABLE"), vars)
        return con.fetchdf()

    monkeypatch.setattr(dummy_rule.DummyRule, "_get_table_query", table_query)
    monkeypatch.setattr(dummy_rule.DummyRule, "run_query", run_query)

    rule = dummy_rule.DummyRule(core_config, user_config)
    return rule

def get_amount(result, payee):
    return result.where(result["payee"] == payee)["amount"][0]

