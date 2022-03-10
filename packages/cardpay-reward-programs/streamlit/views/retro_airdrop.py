import altair as alt
import pandas as pd
import streamlit as st
from cardpay_reward_programs.rules import RetroAirdrop

from .utils import read_attributes

const_start_snapshot_block = 17265698
const_end_snapshot_block = 25165824


def user_defined_parameters(config):
    s = st.expander(label="User defined parameters", expanded=True)
    total_reward = s.number_input(
        "total reward", value=10000000, step=1000000, min_value=1000000, max_value=50000000
    )
    start_snapshot_block = s.number_input(
        "start_snapshot_block",
        value=const_start_snapshot_block,
        step=10,
        min_value=1000000,
        max_value=50000000,
    )
    end_snapshot_block = s.number_input(
        "end_snapshot_block",
        value=const_end_snapshot_block,
        step=10,
        min_value=1000000,
        max_value=50000000,
    )
    user_defined_parameters = {
        "total_reward": total_reward,
        "token": config["token"],
        "subgraph_config_location": {"prepaid_card_payment": config["config_location"]},
        "duration": 43200,
        "start_snapshot_block": start_snapshot_block,
        "end_snapshot_block": end_snapshot_block,
    }
    return user_defined_parameters


def retro_airdrop(core_parameters, config):
    user_parameters = user_defined_parameters(config)
    rule = RetroAirdrop(core_parameters, user_parameters)
    read_attributes(rule)
    return rule


def view_single(core_parameters, config, view_config):
    program = retro_airdrop(core_parameters, config)
    block = st.slider(
        "End block",
        min_value=view_config["start_block"],
        max_value=view_config["end_block"],
        value=view_config["default_block"],
    )
    end_block = block + program.payment_cycle_length
    df = program.run(block, end_block)
    payment_list = program.df_to_payment_list(df, end_block)
    s = st.expander(label="summary stats", expanded=True)
    s.write("reward per transaction = ", program.get_reward_per_transaction())
    s.write(payment_list["amount"].describe())
    return payment_list, df, program.get_summary(payment_list)


def view_multiple(core_parameters, config, view_config):
    program = retro_airdrop(core_parameters, config)
    start_block, end_block = st.slider(
        "Start block - End block",
        min_value=view_config["start_block"],
        max_value=view_config["end_block"],
        value=(const_start_snapshot_block, const_end_snapshot_block),
    )
    progress = st.progress(0.0)
    cached_df = []
    total_payments = []
    for i in range(start_block, end_block, program.payment_cycle_length):
        progress.progress((i - start_block) / (end_block - start_block))
        tail = min(end_block, i + program.payment_cycle_length)
        df = program.run(i, tail)
        total_payments.append({"block": i, "n_transactions": df["transactions"].sum()})
        if not df.empty:
            cached_df.append(df)
    df = program.aggregate(cached_df)
    amounts = (
        alt.Chart(pd.DataFrame(total_payments))
        .mark_bar()
        .encode(
            alt.X("block", bin=alt.Bin()),
            y="n_transactions",
        )
    )
    st.altair_chart(amounts, use_container_width=True)
    payment_list = program.df_to_payment_list(df, end_block)
    s = st.expander(label="summary stats", expanded=True)
    s.write("reward per transaction = ", program.get_reward_per_transaction())
    s.write(payment_list["amount"].describe())
    return payment_list, df, program.get_summary(payment_list)
