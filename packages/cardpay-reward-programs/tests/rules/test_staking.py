import duckdb
import hypothesis.strategies as st
import pandas as pd
import pytest
from cardpay_reward_programs.rules import staking
from hypothesis import example, given
from hypothesis.extra.pandas import column, data_frames, range_indexes
from pytest import MonkeyPatch

END_BLOCK = 60
CYCLE_LENGTH = 30
token_holder_table = "_TOKEN_HOLDER"
safe_ownership_table = "_SAFE_OWNERSHIP"

owner_st = st.from_regex(r"owner\-[0-2]", fullmatch=True)
safe_st = st.from_regex(r"safe\-[0-2]", fullmatch=True)
card_st = st.from_regex(r"card\-[0-0]", fullmatch=True)
depot_st = st.from_regex(r"depot", fullmatch=True)
block_number_so_st = st.integers(min_value=0, max_value=1)
block_number_st = st.integers(min_value=1, max_value=END_BLOCK + 50)
balance_st = st.integers(min_value=1, max_value=24032768)

safe_owner_columns = {
    "owner": {"elements": owner_st, "unique": True},
    "safe": {"elements": safe_st, "unique": True},
    "type": {"elements": depot_st},
    "_block_number": {"elements": block_number_so_st},
}

token_holder_columns = {
    "_block_number": {"elements": block_number_st, "unique": True},
    "safe": {"elements": safe_st},
    "token": {"elements": card_st},
    "balance_downscale_e9_uint64": {"elements": balance_st},
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
        "duration": 30,
        "start_block": 0,
        "end_block": END_BLOCK,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            "spend_accumulation": "s3://tall-data-dev/paulin/spend_accumulation/0.0.1/",
            "safe_owner": "s3://tall-data-dev/paulin/safe_owner/0.0.1/",
        },
    }

    core_config.update(core_config_overrides)
    user_config = {"token": "card-0", "interest_rate_monthly": 0.06}

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


def get_amount(result, payee):
    idx = result.index[result["payee"] == payee].tolist()[0]
    return result.loc[idx, "amount"]


def test_correct_calc_rewards(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1000,
            },
            {
                "_block_number": 10,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1500,
            },
            {
                "_block_number": 20,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1750,
            },
            {
                "_block_number": 25,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1500,
            },
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe2",
                "balance_downscale_e9_uint64": 1000,
            },
            {
                "_block_number": 10,
                "token": "card-0",
                "safe": "safe2",
                "balance_downscale_e9_uint64": 1500,
            },
            {
                "_block_number": 15,
                "token": "card-0",
                "safe": "safe2",
                "balance_downscale_e9_uint64": 1200,
            },
            {
                "_block_number": 20,
                "token": "card-0",
                "safe": "safe2",
                "balance_downscale_e9_uint64": 1700,
            },
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe3",
                "balance_downscale_e9_uint64": 1000,
            },
        ]
    )

    fake_data_safe_owner = pd.DataFrame(
        [
            {"safe": "safe1", "owner": "owner1", "type": "depot", "_block_number": 0},
            {"safe": "safe2", "owner": "owner2", "type": "depot", "_block_number": 0},
            {"safe": "safe3", "owner": "owner3", "type": "depot", "_block_number": 0},
        ]
    )

    rule = create_rule(monkeypatch, fake_data_token_holder, fake_data_safe_owner)
    result = rule.run(30, "0x0")

    assert pytest.approx(get_amount(result, "owner1")) == 82.26866088e9
    assert pytest.approx(get_amount(result, "owner2")) == 80.74258498e9
    assert pytest.approx(get_amount(result, "owner3")) == 60e9


def test_correctly_manages_first_deposit_in_cycle(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1000,
            },
            {
                "_block_number": 30,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 2000,
            },
        ]
    )

    fake_data_safe_owner = pd.DataFrame(
        [{"safe": "safe1", "owner": "owner1", "type": "depot", "_block_number": 0}]
    )

    rule = create_rule(monkeypatch, fake_data_token_holder, fake_data_safe_owner)
    result = rule.run(60, "0x0")

    assert pytest.approx(get_amount(result, "owner1")) == 120e9


def test_correct_calc_rewards_in_cycle(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1000,
            }
        ]
    )

    fake_data_safe_owner = pd.DataFrame(
        [{"safe": "safe1", "owner": "owner1", "type": "depot", "_block_number": 0}]
    )

    rule = create_rule(monkeypatch, fake_data_token_holder, fake_data_safe_owner)
    result = rule.run(30, "0x0")

    assert pytest.approx(get_amount(result, "owner1")) == 60e9


def test_correct_filtering_of_safe_type(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1000,
            },
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe2",
                "balance_downscale_e9_uint64": 1000,
            },
        ]
    )

    fake_data_safe_owner = pd.DataFrame(
        [
            {"safe": "safe1", "owner": "owner1", "type": "depot", "_block_number": 0},
            {"safe": "safe1", "owner": "owner1", "type": "prepaid", "_block_number": 0},
        ]
    )

    rule = create_rule(monkeypatch, fake_data_token_holder, fake_data_safe_owner)
    result = rule.run(30, "0x0")
    assert len(result) == 1


def test_correct_filtering_of_token(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1000,
            },
            {
                "_block_number": 0,
                "token": "card-1",
                "safe": "safe2",
                "balance_downscale_e9_uint64": 1000,
            },
        ]
    )

    fake_data_safe_owner = pd.DataFrame(
        [
            {"safe": "safe1", "owner": "owner1", "type": "depot", "_block_number": 0},
            {"safe": "safe2", "owner": "owner2", "type": "depot", "_block_number": 0},
        ]
    )

    rule = create_rule(monkeypatch, fake_data_token_holder, fake_data_safe_owner)
    result = rule.run(30, "0x0")
    assert len(result) == 1


def test_change_of_safes_during_payment_cycle(monkeypatch):
    """
    For this test I am assuming the safe_owner has a block_number as token holde but I am not entirely sure
    This is test currently passed
    """
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1000,
            },
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe2",
                "balance_downscale_e9_uint64": 1000,
            },
        ]
    )

    fake_data_safe_owner = pd.DataFrame(
        [
            {"safe": "safe1", "owner": "owner1", "type": "depot", "_block_number": 0},
            {"safe": "safe1", "owner": "owner2", "type": "depot", "_block_number": 10},
        ]
    )

    rule = create_rule(monkeypatch, fake_data_token_holder, fake_data_safe_owner)
    result = rule.run(30, "0x0")
    assert len(result) == 1


@given(token_holder_df, safe_owner_df)
def test_num_of_safes_matches_results(token_holder_df, safe_owner_df):
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
        payees = set()
        for _, row in token_holder_df.iterrows():
            cur_block_num = row["_block_number"]
            if (
                0 <= cur_block_num < END_BLOCK
                and row["balance_downscale_e9_uint64"] > 0
            ):
                rewarded_safe = row["safe"]
                owner = safe_owner_df.where(safe_owner_df["safe"] == rewarded_safe)[
                    "owner"
                ][0]
                if type(owner) == str:
                    payees.add(owner)

        result = rule.run(END_BLOCK, "0x0")
        all_positive_rewards = True

        for payee in payees:
            if result.where(result["payee"] == payee)["amount"][0] <= 0:
                all_positive_rewards = False
        assert all_positive_rewards


def apply_transfers(starting_balances, transfers):
    history = [
        {
            "_block_number": 0,
            "token": "card-0",
            "safe": f"safe{n}",
            "balance_downscale_e9_uint64": balance,
        }
        for n, balance in enumerate(starting_balances)
    ]

    accounts = [
        {"balance": balance, "last_changed": 0, "safe": f"safe{n}"}
        for n, balance in enumerate(starting_balances)
    ]

    for transfer in sorted(transfers, key=lambda x: x[3]):
        from_acct, to_acct, amount, block = transfer
        # Multiple transfers per block per account are trickier but not relevant here
        if (
            accounts[from_acct]["last_changed"] == block
            or accounts[to_acct]["last_changed"] == block
        ):
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
                "balance_downscale_e9_uint64": accounts[from_acct]["balance"],
            }
        )
        history.append(
            {
                "_block_number": block,
                "token": "card-0",
                "safe": f"safe{to_acct}",
                "balance_downscale_e9_uint64": accounts[to_acct]["balance"],
            }
        )

    return pd.DataFrame(history)


@given(
    st.lists(st.integers(min_value=0, max_value=1_000), min_size=10, max_size=10),
    st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=9),  # from
            st.integers(min_value=0, max_value=9),  # to
            st.integers(min_value=0, max_value=1000),  # amount
            st.integers(min_value=0, max_value=1000),  # block
        ),
        min_size=0,
        max_size=1000,
    ),
    st.integers(min_value=30, max_value=1000),  # payment cycle
    st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=9),  # safe
            st.integers(min_value=0, max_value=9),  # new owner
            st.integers(min_value=0, max_value=1000),  # block
        ),
    ),
)
@example(
    safe_ownership_changes=[(4, 0, 0)],
    payment_cycle=30,
    transfers=[],
    starting_balances=[0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
)
def test_reward_given_tokens(
    starting_balances, transfers, payment_cycle, safe_ownership_changes
):
    interest_rate = 0.1
    with MonkeyPatch.context() as monkeypatch:

        token_holder_df = apply_transfers(starting_balances, transfers)
        safe_owners = [
            {
                "safe": f"safe{n}",
                "owner": f"owner{n}",
                "type": "depot",
                "_block_number": 0,
            }
            for n in range(len(starting_balances))
        ]
        for safe, owner, block in safe_ownership_changes:
            safe_owners.append(
                {
                    "safe": f"safe{safe}",
                    "owner": f"owner{owner}",
                    "type": "depot",
                    "_block_number": block,
                }
            )

        safe_owner_df = pd.DataFrame(safe_owners)
        rule = create_rule(
            monkeypatch,
            token_holder_df,
            safe_owner_df,
            user_config_overrides={"interest_rate_monthly": interest_rate},
        )
        result = rule.run(payment_cycle, "0x0")
        assert (
            pytest.approx(sum(result["amount"]))
            == interest_rate * sum(starting_balances) * 1e9
        )


@given(
    st.lists(st.integers(min_value=0, max_value=60), min_size=1, max_size=100),
)
@example(
    blocks=[0],
)
@example(
    blocks=[0, 30],
)
@example(
    blocks=[0, 10, 20, 30],
)
def test_rewards_identically_if_balance_never_changes(blocks):
    blocks = [0]
    interest_rate = 0.1
    with MonkeyPatch.context() as monkeypatch:

        starting_balances = [
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe0",
                "balance_downscale_e9_uint64": 100,
            }
        ]
        balance_history = [
            {
                "_block_number": block,
                "token": "card-0",
                "safe": "safe0",
                "balance_downscale_e9_uint64": 100,
            }
            for block in blocks
        ]
        safe_owners = [
            {
                "safe": "safe0",
                "owner": "owner0",
                "type": "depot",
                "_block_number": 0,
            }
        ]

        rule_single_balance = create_rule(
            monkeypatch,
            pd.DataFrame(starting_balances),
            pd.DataFrame(safe_owners),
            user_config_overrides={"interest_rate_monthly": interest_rate},
        )
        result_single_balance = rule_single_balance.run(30, "0x0")
        rule_multiple_balance = create_rule(
            monkeypatch,
            pd.DataFrame(balance_history),
            pd.DataFrame(safe_owners),
            user_config_overrides={"interest_rate_monthly": interest_rate},
        )
        result_multiple_balance = rule_multiple_balance.run(30, "0x0")
        assert pytest.approx(sum(result_single_balance["amount"])) == 10e9
        assert pytest.approx(sum(result_multiple_balance["amount"])) == 10e9


def test_staking_does_not_use_start_and_end_blocks(monkeypatch):
    """
    The start & end blocks are variables for the *scheduler* not the rule.

    It should not affect the data read to calculate ownership of safes or the balances.

    When querying for the partitions, the min partition here should be None
    which signifies that data from the earliest block is required
    and the max partition should be the payment cycle as that's the latest
    data that is required.
    """
    payment_cycle = 35
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "_block_number": 0,
                "token": "card-0",
                "safe": "safe1",
                "balance_downscale_e9_uint64": 1000,
            },
        ]
    )

    fake_data_safe_owner = pd.DataFrame(
        [
            {"safe": "safe1", "owner": "owner1", "type": "depot", "_block_number": 0},
        ]
    )

    rule = create_rule(
        monkeypatch,
        fake_data_token_holder,
        fake_data_safe_owner,
        core_config_overrides={"start_block": 30},
    )

    def table_query(
        self, config_name, table_name, min_partition: int, max_partition: int
    ):
        assert min_partition is None
        assert max_partition == payment_cycle

        if table_name == "token_holder":
            return token_holder_table
        elif table_name == "safe_owner":
            return safe_ownership_table
        else:
            raise NameError

    monkeypatch.setattr(staking.Staking, "_get_table_query", table_query)

    result = rule.run(payment_cycle, "0x0")

    assert pytest.approx(get_amount(result, "owner1")) == 60e9
