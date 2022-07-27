import pytest
import pandas as pd
import duckdb
import math
import hypothesis.strategies as st
import hypothesis.strategies as tuples
from cardpay_reward_programs.rules import safe_ownership, staking
from hypothesis import given
from hypothesis.extra.pandas import data_frames, columns

token_holder_table = "_TOKEN_HOLDER"
safe_ownership_table = "_SAFE_OWNERSHIP"
token_holder_columns = ["_block_number", "token", "safe", "balance_uint64"]
token_holder_df = data_frames(columns = columns(token_holder_columns, dtype = str),
                                rows = st.tuples(
                                    st.integers(min_value = 1000000, max_value = 18446744073709551615),
                                    st.from_regex("card\-[0-9]", fullmatch = True),
                                    st.from_regex("safe\-[0-9]", fullmatch = True),
                                    st.floats(min_value = 22995968, max_value = 24032768)
                                )
)
safe_owner_columns = ["safe", "owner"]
safe_owner_df = data_frames(columns = columns(safe_owner_columns, dtype = str),
                            rows = st.tuples(
                                st.from_regex("owner\-[0-9]", fullmatch = True),
                                st.from_regex("safe\-[0-9]", fullmatch = True),
                            )
                            
                )

def create_rule(
    monkeypatch, fake_data_token_holder, fake_data_safe_owner, core_config_overrides={}, user_config_overrides={}
):
    core_config = {
        "payment_cycle_length": 30,
        "start_block": 0,
        "end_block": 30,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            "spend_accumulation": "s3://tall-data-dev/paulin/spend_accumulation/0.0.1/",
            "safe_owner": "s3://tall-data-dev/paulin/safe_owner/0.0.1/"  
        }
    }

    core_config.update(core_config_overrides)
    user_config = {
        "token": "card",
        "duration": 30,
        "interest_rate_monthly": 0.06
    }

    user_config.update(user_config_overrides)
    con = duckdb.connect(database=":memory:", read_only=False)
    con.execute(f"""create table {token_holder_table} as select * from fake_data_token_holder""")
    con.execute(f"""create table {safe_ownership_table} as select * from fake_data_safe_owner""")

    def table_query(self, config_name, table_name, min_partition: int, max_partition: int):
        
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
   
   
def test_correctly_compound_interest(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "id": 1,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1000
            },
            {
                "_block_number": 10,
                "id": 1,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1500
            },
            {
                "_block_number": 15,
                "id": 1,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1200
            },
            {
                "_block_number": 20,
                "id": 1,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1700
            },
            {
                "_block_number": 25,
                "id": 1,
                "token": "card",
                "safe": "safe1",
                "balance_uint64": 1900
            },
            {
                "_block_number": 0,
                "id": 2,
                "token": "card",
                "safe": "safe2",
                "balance_uint64": 1500
            },
            {
                "_block_number": 0,
                "id": 2,
                "token": "card",
                "safe": "safe2",
                "balance_uint64": 1500
            },   
            {
                "_block_number": 15,
                "id": 2,
                "token": "card",
                "safe": "safe2",
                "balance_uint64": 1200
            },
            {
                "_block_number": 25,
                "id": 2,
                "token": "card",
                "safe": "safe2",
                "balance_uint64": 1000
            }, 
            {
                "_block_number": 0,
                "id": 3,
                "token": "card",
                "safe": "safe3",
                "balance_uint64": 1500
            }, 
        ]    
    )

    fake_data_safe_owner = pd.DataFrame(
        [
            {
                "safe":"safe1",
                "owner":"owner1"
            },
            {
                "safe": "safe2",
                "owner": "owner2"
            },
            {
                "safe": "safe3",
                "owner": "owner3"
            }
        ]   
    )

    rule = create_rule(
        monkeypatch, fake_data_token_holder, fake_data_safe_owner
    )
    result = rule.run(30, "0x0")
    assert len(result) == 3

def test_correct_calc_rewards(monkeypatch):
    fake_data_token_holder = pd.DataFrame([
        {
            "_block_number": 0,
            "token": "card",
            "safe": "safe1",
            "balance_uint64": 1000
        },
        {
            "_block_number": 10,
            "token": "card",
            "safe": "safe1",
            "balance_uint64": 1500
        },
        {
            "_block_number": 20,
            "token": "card",
            "safe": "safe1",
            "balance_uint64": 1750
        },
        {
            "_block_number": 25,
            "token": "card",
            "safe": "safe1",
            "balance_uint64": 1500
        },
        {
            "_block_number": 0,
            "token": "card",
            "safe": "safe2",
            "balance_uint64": 1000
        },
        {
            "_block_number": 10,
            "token": "card",
            "safe": "safe2",
            "balance_uint64": 1500
        },
        {
            "_block_number": 15,
            "token": "card",
            "safe": "safe2",
            "balance_uint64": 1200
        },
        {
            "_block_number": 20,
            "token": "card",
            "safe": "safe2",
            "balance_uint64": 1700
        },
        {
            "_block_number": 0,
            "token": "card",
            "safe": "safe3",
            "balance_uint64": 1000
        }

    ])

    fake_data_safe_owner = pd.DataFrame([
        {
            "safe":"safe1",
            "owner":"owner1"
        },
        {
            "safe":"safe2",
            "owner":"owner2"
        },
        {
            "safe":"safe3",
            "owner":"owner3"
        }
    ])

    rule = create_rule(
        monkeypatch, fake_data_token_holder, fake_data_safe_owner
    )
    result = rule.run(30, "0x0")
    print(get_amount(result, "owner1", 0))
    assert math.ceil(get_amount(result, "owner1", 0)) == math.ceil(82.26866088)
    assert math.ceil(get_amount(result, "owner2", 1)) == math.ceil(80.74)
    assert math.ceil(get_amount(result, "owner3", 2)) == math.ceil(60)


def test_correctly_manages_first_deposit_in_cycle(monkeypatch):
    fake_data_token_holder = pd.DataFrame([
        {
            "_block_number": 0,
            "token": "card",
            "safe": "safe1",
            "balance_uint64": 1000
        },
        {
            "_block_number": 30,
            "token": "card",
            "safe": "safe1",
            "balance_uint64": 2000
        }
    ])

    fake_data_safe_owner = pd.DataFrame([
        {
            "safe":"safe1",
            "owner":"owner1"
        }
    ])

    rule = create_rule(
        monkeypatch, fake_data_token_holder, fake_data_safe_owner
    )
    result = rule.run(60, "0x0")
    
    assert pytest.approx(get_amount(result, "owner1", 0)) == 120


def test_correct_calc_rewards_in_cycle(monkeypatch, i = 0, j = 0):
    fake_data_token_holder = pd.DataFrame([
        {
            "_block_number": 0,
            "token": "card",
            "safe": "safe1",
            "balance_uint64": 1000
        }
    ])

    fake_data_safe_owner = pd.DataFrame([
        {
            "safe":"safe1",
            "owner":"owner1"
        }
    ])

    rule = create_rule(
        monkeypatch, fake_data_token_holder, fake_data_safe_owner
    )
    result = rule.run(30, "0x0")
    
    assert pytest.approx(get_amount(result, "owner1", 0)) == 60

@given(token_holder_df, safe_owner_df)
def test_hypothesis(token_holder_df, safe_owner_df):
    assert len(token_holder_df) > -1 

@given(st.integers(), st.integers())
def test_b(x, y, monkeypatch):
    print(x, y)
    assert 0 == 0

    
