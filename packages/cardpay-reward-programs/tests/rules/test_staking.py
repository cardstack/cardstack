import pytest
import pandas as pd
import duckdb
import math
import hypothesis.strategies as st
from cardpay_reward_programs.rules import staking
from hypothesis import given
from hypothesis.extra.pandas import data_frames, range_indexes, column
from pytest import MonkeyPatch

START_BLOCK = 30
END_BLOCK = 60
CYCLE_LENGTH = 30
token_holder_table = "_TOKEN_HOLDER"
safe_ownership_table = "_SAFE_OWNERSHIP"

owner_st = st.from_regex(r"owner\-[0-2]", fullmatch=True)
safe_st = st.from_regex(r"safe\-[0-2]", fullmatch=True)
card_st = st.from_regex(r"card\-[0-0]", fullmatch=True)
block_number_st = st.integers(min_value=START_BLOCK - 5, max_value=END_BLOCK + 5)
balance_st = st.integers(min_value=22995968, max_value=24032768)

safe_owner_columns = {
    "owner": {"elements": owner_st, "unique": True},
    "safe": {"elements": safe_st, "unique": True},
}

token_holder_columns = {
    "_block_number": {"elements": block_number_st, "unique": True},
    "safe": {"elements": safe_st},
    "token": {"elements": card_st},
    "balance_uint64": {"elements": balance_st, "unique": True},
}

safe_owner_df = data_frames(
    index=range_indexes(min_size=3, max_size=3),
    columns=[column(key, **value) for key, value in safe_owner_columns.items()],
)

token_holder_df = data_frames(
    index=range_indexes(min_size=3, max_size=4),
    columns=[column(key, **value) for key, value in token_holder_columns.items()],
)


def create_rule(
    monkeypatch,
    fake_data_token_holder,
    fake_data_safe_owner,
    core_config_overrides={},
    user_config_overrides={},
):
    core_config = {
        "payment_cycle_length": CYCLE_LENGTH,
        "start_block": START_BLOCK,
        "end_block": END_BLOCK,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            "spend_accumulation": "s3://tall-data-dev/paulin/spend_accumulation/0.0.1/",
            "safe_owner": "s3://tall-data-dev/paulin/safe_owner/0.0.1/",
        },
    }

    core_config.update(core_config_overrides)
    user_config = {"token": "card-0", "duration": 30, "interest_rate_monthly": 0.06}

    user_config.update(user_config_overrides)
    con = duckdb.connect(database=":memory:", read_only=False)
    con.execute(
        f"""create table {token_holder_table} as select * from fake_data_token_holder"""
    )
    con.execute(
        f"""create table {safe_ownership_table} as select * from fake_data_safe_owner"""
    )

    def table_query(
        self, config_name, table_name, min_partition: int, max_partition: int
    ):

        if table_name == "token_holder":
            return token_holder_table
        elif table_name == "safe_owner":
            return safe_ownership_table
        else:
            raise NameError

    def run_query(self, table_query, vars, aux_table_query):
        con.execute(self.sql(token_holder_table, safe_ownership_table), vars)
        return con.fetchdf()

    monkeypatch.setattr(staking.Staking, "_get_table_query", table_query)
    monkeypatch.setattr(staking.Staking, "run_query", run_query)

    rule = staking.Staking(core_config, user_config)
    return rule


def get_amount(result, payee, idx):
    idx = result.index[result["payee"] == payee].tolist()[0]
    return result.loc[idx, "amount"]


def tst_correct_calc_rewards(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1000,
            },
            {
                "_block_number": 10,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1500,
            },
            {
                "_block_number": 20,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1750,
            },
            {
                "_block_number": 25,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1500,
            },
            {
                "_block_number": 0,
                "token": "card",
                "safe": "safe2",
                "balance_uint64": 1000,
            },
            {
                "_block_number": 10,
                "token": "card",
                "safe": "safe2",
                "balance_uint64": 1500,
            },
            {
                "_block_number": 15,
                "token": "card",
                "safe": "safe2",
                "balance_uint64": 1200,
            },
            {
                "_block_number": 20,
                "token": "card",
                "safe": "safe2",
                "balance_uint64": 1700,
            },
            {
                "_block_number": 0,
                "token": "card",
                "safe": "safe3",
                "balance_uint64": 1000,
            },
        ]
    )

    fake_data_safe_owner = pd.DataFrame(
        [
            {"safe": "safe1", "owner": "owner1"},
            {"safe": "safe2", "owner": "owner2"},
            {"safe": "safe3", "owner": "owner3"},
        ]
    )

    rule = create_rule(monkeypatch, fake_data_token_holder, fake_data_safe_owner)
    result = rule.run(30, "0x0")
    print(get_amount(result, "owner1", 0))
    assert math.ceil(get_amount(result, "owner1", 0)) == math.ceil(82.26866088)
    assert math.ceil(get_amount(result, "owner2", 1)) == math.ceil(80.74)
    assert math.ceil(get_amount(result, "owner3", 2)) == math.ceil(60)


def tst_correctly_manages_first_deposit_in_cycle(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1000,
            },
            {
                "_block_number": 30,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 2000,
            },
        ]
    )

    fake_data_safe_owner = pd.DataFrame([{"safe": "safe1", "owner": "owner1"}])

    rule = create_rule(monkeypatch, fake_data_token_holder, fake_data_safe_owner)
    result = rule.run(60, "0x0")

    assert pytest.approx(get_amount(result, "owner1", 0)) == 120


def tst_correct_calc_rewards_in_cycle(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [{"_block_number": 0, "token": "card", "safe": "safe1", "balance_uint64": 1000}]
    )

    fake_data_safe_owner = pd.DataFrame([{"safe": "safe1", "owner": "owner1"}])

    rule = create_rule(monkeypatch, fake_data_token_holder, fake_data_safe_owner)
    result = rule.run(30, "0x0")

    assert pytest.approx(get_amount(result, "owner1", 0)) == 60


@given(token_holder_df, safe_owner_df)
def test_num_of_safes_matches_results(token_holder_df, safe_owner_df):
    """
    testing that number of safes within range matches the len of payees
    """
    with MonkeyPatch.context() as monkeypatch:
        rule = create_rule(monkeypatch, token_holder_df, safe_owner_df)
        safes_set = set()
        for _, instance in token_holder_df.iterrows():
            if instance["_block_number"] < END_BLOCK:
                safes_set.add(instance["safe"])

        result = rule.run(END_BLOCK, "0x0")
        assert len(result) == len(safes_set)


@given(token_holder_df, safe_owner_df)
def test_all_stakers_receiving_rewards(token_holder_df, safe_owner_df):
    """
    testing the any owner with some staking during the cycle receive rewards
    """
    with MonkeyPatch.context() as monkeypatch:
        rule = create_rule(monkeypatch, token_holder_df, safe_owner_df)
        payees_list = []
        safes_set = set()
        for _, row in token_holder_df.iterrows():
            cur_block_num = row["_block_number"]
            if START_BLOCK <= cur_block_num <= END_BLOCK:
                rewarded_safe = row["safe"]
                if rewarded_safe in safes_set:
                    return
                safes_set.add(rewarded_safe)
                owner = safe_owner_df.where(safe_owner_df["safe"] == rewarded_safe)[
                    "owner"
                ][0]
                if type(owner) == str:
                    payees_list.append(owner)
        result = rule.run(END_BLOCK, "0x0")
        print(result)
        all_positive_rewards = True

        for payee in payees_list:
            if result.where(result["payee"] == payee)["amount"][0] <= 0:
                all_positive_rewards = False
        assert all_positive_rewards
