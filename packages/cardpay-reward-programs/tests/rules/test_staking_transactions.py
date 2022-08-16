import pytest
import pandas as pd
import duckdb
import math
import hypothesis.strategies as st
import hypothesis.strategies as tuples
from hypothesis import given, settings, example
from cardpay_reward_programs.rules import staking
from pytest import MonkeyPatch

START_BLOCK = 30
END_BLOCK = 60
CYCLE_LENGTH = 30
token_holder_table = "_TOKEN_HOLDER"
safe_ownership_table = "_SAFE_OWNERSHIP"         

def create_rule(
    monkeypatch, fake_data_token_holder, fake_data_safe_owner, core_config_overrides={}, user_config_overrides={}
):
    core_config = {
        "payment_cycle_length": CYCLE_LENGTH,
        "start_block": 0,
        "end_block": END_BLOCK,
        "subgraph_config_locations": {
        }
    }

    core_config.update(core_config_overrides)
    user_config = {
        "token": "card-0",
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



def apply_transfers(starting_balances, transfers):
    history = [
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": f"safe{n}",
                "balance_downscale_e9_uint64": balance
            }
            for n, balance in enumerate(starting_balances)
        ]

    accounts = [{
        "balance": balance,
        "last_changed": 0,
        "safe": f"safe{n}"
    } for n, balance in enumerate(starting_balances)]

    for transfer in sorted(transfers, key = lambda x: x[3]):
        from_acct, to_acct, amount, block = transfer
        # Multiple transfers per block per account are trickier but not relevant here
        if accounts[from_acct]["last_changed"] == block or accounts[to_acct]["last_changed"] == block:
            continue
        # Can't send more than you have
        amount = min(amount, accounts[from_acct]["balance"])
        # Update balances
        accounts[from_acct]["balance"] -= amount
        accounts[to_acct]["balance"] += amount
        accounts[from_acct]["last_changed"] = block
        accounts[to_acct]["last_changed"] = block
        history.append(
            {
                "_block_number": block,
                "token": "card-0",
                "safe": f"safe{from_acct}",
                "balance_downscale_e9_uint64": accounts[from_acct]["balance"]
            }
        )
        history.append(
            {
                "_block_number": block,
                "token": "card-0",
                "safe": f"safe{to_acct}",
                "balance_downscale_e9_uint64": accounts[to_acct]["balance"]
            }
        )

    return pd.DataFrame(history)


@given(st.lists(st.integers(min_value=0, max_value=1_000), min_size=10, max_size=10),
st.lists(
    st.tuples(
        st.integers(min_value=0, max_value=9), # from
        st.integers(min_value=0, max_value=9), # to
        st.integers(min_value=0, max_value=1000), # amount
        st.integers(min_value=0, max_value=1000) # block
    ),
    min_size=0, max_size=1000
    ),
st.integers(min_value=30, max_value=1000), # payment cycle
st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=9), # safe
            st.integers(min_value=0, max_value=9), # new owner
            st.integers(min_value=0, max_value=1000) # block
        ),
    )
)
@example(
    safe_ownership_changes=[(4, 0, 0)],
    payment_cycle=30,
    transfers=[],
    starting_balances=[0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
)
@settings(max_examples=100)
def test_reward_given_tokens(starting_balances, transfers, payment_cycle, safe_ownership_changes):
    interest_rate = 0.1
    with MonkeyPatch.context() as monkeypatch:
        
        token_holder_df = apply_transfers(starting_balances, transfers)
        print(token_holder_df)
        safe_owners = [
            {
                "safe":f"safe{n}",
                "owner":f"owner{n}",
                "type":"depot",
                "_block_number": 0
            }
            for n in range(len(starting_balances))
        ]
        for safe, owner, block in safe_ownership_changes:
            safe_owners.append(
                {
                    "safe":f"safe{safe}",
                    "owner":f"owner{owner}",
                    "type":"depot",
                    "_block_number": block
                }
            )

        safe_owner_df = pd.DataFrame(safe_owners)
        print(safe_owner_df)
        rule = create_rule(
            monkeypatch, token_holder_df, safe_owner_df,
            user_config_overrides={
                "interest_rate_monthly": interest_rate

            }
        )
        result = rule.run(payment_cycle, "0x0")
        assert pytest.approx(sum(result["amount"])) == interest_rate*sum(starting_balances)*1e9



