import pandas as pd
import duckdb

from cardpay_reward_programs.rules import safe_ownership


def create_rule(
    monkeypatch, fake_data, core_config_overrides={}, user_config_overrides={}
):
    core_config = {
        "start_block": 0,
        "end_block": 10000,
        "payment_cycle_length": 1000,
        "subgraph_config_locations": {
            "safe_owner": "s3://partitioned-graph-data/data/safe_owner/0.0.1/"
        },
    }
    core_config.update(core_config_overrides)
    user_config = {
        "reward_per_safe": 1,
        "token": "0x0000000000000000000000000000000000000000",
        "duration": 43200,
        "start_analysis_block": 0,
        "safe_type": "type_a",
        "max_rewards": 10,
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

    monkeypatch.setattr(safe_ownership.SafeOwnership, "_get_table_query", table_query)
    monkeypatch.setattr(safe_ownership.SafeOwnership, "run_query", run_query)

    rule = safe_ownership.SafeOwnership(core_config, user_config)
    return rule


def get_amount(result, payee):
    return result.where(result["payee"] == payee)["amount"][0]


def test_identifies_correct_safe_type(monkeypatch):
    fake_data = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 150},
            {"owner": "0xA", "safe": "0x2", "type": "type_b", "_block_number": 150},
        ]
    )

    rule = create_rule(monkeypatch, fake_data)
    result = rule.run(200, "0x0")
    assert len(result) == 1


def test_users_can_be_rewarded_multiple_times(monkeypatch):
    fake_data = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 150},
            {"owner": "0xA", "safe": "0x2", "type": "type_a", "_block_number": 151},
        ]
    )

    rule = create_rule(
        monkeypatch, fake_data, {"payment_cycle_length": 100}, {"max_rewards": 2}
    )
    result = rule.run(200, "0x0")
    assert len(result) == 1
    assert get_amount(result, "0xA") == 2


def test_users_cant_be_rewarded_more_than_max_times_in_one_cycle(monkeypatch):
    fake_data = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 150},
            {"owner": "0xA", "safe": "0x2", "type": "type_a", "_block_number": 151},
            {"owner": "0xA", "safe": "0x3", "type": "type_a", "_block_number": 152},
            {"owner": "0xA", "safe": "0x4", "type": "type_a", "_block_number": 153},
        ]
    )

    rule = create_rule(
        monkeypatch, fake_data, {"payment_cycle_length": 100}, {"max_rewards": 2}
    )
    result = rule.run(200, "0x0")
    assert len(result) == 1
    assert get_amount(result, "0xA") == 2


def test_users_cant_be_rewarded_more_than_max_times_in_multiple_cycles(monkeypatch):
    fake_data = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 20},
            {"owner": "0xA", "safe": "0x2", "type": "type_a", "_block_number": 151},
            {"owner": "0xA", "safe": "0x3", "type": "type_a", "_block_number": 152},
            {"owner": "0xA", "safe": "0x4", "type": "type_a", "_block_number": 153},
        ]
    )

    rule = create_rule(
        monkeypatch, fake_data, {"payment_cycle_length": 100}, {"max_rewards": 3}
    )
    result = rule.run(200, "0x0")
    assert len(result) == 1
    assert get_amount(result, "0xA") == 2


def test_users_are_only_rewarded_for_current_cycle(monkeypatch):
    fake_data = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 20},
            {"owner": "0xA", "safe": "0x2", "type": "type_a", "_block_number": 21},
            {"owner": "0xA", "safe": "0x3", "type": "type_a", "_block_number": 153},
            {"owner": "0xA", "safe": "0x4", "type": "type_a", "_block_number": 153},
        ]
    )

    rule = create_rule(
        monkeypatch, fake_data, {"payment_cycle_length": 100}, {"max_rewards": 3}
    )
    result = rule.run(200, "0x0")
    assert len(result) == 1
    assert get_amount(result, "0xA") == 1


def test_users_are_only_rewarded_for_distinct_safe_ownerships(monkeypatch):
    fake_data = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 150},
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 151},
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 152},
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 153},
        ]
    )

    rule = create_rule(
        monkeypatch, fake_data, {"payment_cycle_length": 100}, {"max_rewards": 3}
    )
    result = rule.run(200, "0x0")
    assert len(result) == 1
    assert get_amount(result, "0xA") == 1


def test_users_are_only_rewarded_if_in_current_cycle(monkeypatch):
    fake_data = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 20},
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 21},
            {"owner": "0xA", "safe": "0x1", "type": "type_a", "_block_number": 22},
            {"owner": "0xB", "safe": "0x1", "type": "type_a", "_block_number": 153},
        ]
    )

    rule = create_rule(
        monkeypatch, fake_data, {"payment_cycle_length": 100}, {"max_rewards": 3}
    )
    result = rule.run(200, "0x0")
    # Only 0xB was in the latest cycle
    assert len(result) == 1
    assert get_amount(result, "0xB") == 1
