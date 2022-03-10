import altair as alt
import pandas as pd
import streamlit as st
from cardpay_reward_programs.rules import WeightedUsage

from .utils import read_attributes


def user_defined_parameters(config):
    s = st.expander(label="User defined parameters", expanded=True)
    base_reward = s.number_input("Base reward", value=5, step=1, min_value=0, max_value=100)
    transaction_factor = s.number_input(
        "Transaction factor", value=2.0, step=0.1, min_value=0.0, max_value=10.0
    )
    spend_factor = s.number_input(
        "Spend factor", value=2.0, step=0.1, min_value=0.0, max_value=10.0
    )
    user_defined_parameters = {
        "base_reward": base_reward,
        "transaction_factor": transaction_factor,
        "spend_factor": spend_factor,
        "token": config["token"],
        "subgraph_config_location": {"prepaid_card_payment": config["config_location"]},
        "duration": 43200,
    }
    return user_defined_parameters


def weighted_usage(core_parameters, config):
    user_parameters = user_defined_parameters(config)
    rule = WeightedUsage(core_parameters, user_parameters)
    read_attributes(rule)
    return rule


def view_multiple(core_parameters, config, view_config):
    program = weighted_usage(core_parameters, config)
    start_block, end_block = st.slider(
        "Start block - End block",
        min_value=view_config["start_block"],
        max_value=view_config["end_block"],
        value=(view_config["start_block"], view_config["default_block"]),
    )
    progress = st.progress(0.0)
    payments = []
    cached_df = []
    for i in range(start_block, end_block, program.payment_cycle_length):
        progress.progress((i - start_block) / (end_block - start_block))
        tail = min(end_block, i + program.payment_cycle_length)
        df = program.run(i, tail)
        payments.append({"block": i, "amount": df["amount"].sum()})
        if not df.empty:
            cached_df.append(df)

    df = program.aggregate(cached_df)
    payment_list = program.df_to_payment_list(df, end_block)
    multiple_df = pd.DataFrame(payments)
    amount_each_cycle = (
        alt.Chart(multiple_df)
        .mark_bar()
        .encode(
            alt.X("block"),
            y="amount",
        )
    )

    st.altair_chart(amount_each_cycle, use_container_width=True)
    amounts = (
        alt.Chart(multiple_df)
        .mark_bar()
        .encode(
            alt.X("amount:Q", bin=alt.Bin()),
            y="count()",
        )
    )

    st.altair_chart(amounts, use_container_width=True)
    return payment_list, df, program.get_summary(payment_list)


def view_single(core_parameters, config, view_config):
    program = weighted_usage(core_parameters, config)
    block = st.slider(
        "End block",
        min_value=view_config["start_block"],
        max_value=view_config["end_block"],
        value=view_config["default_block"],
    )
    end_block = block + program.payment_cycle_length
    df = program.run(block, end_block)
    payment_list = program.df_to_payment_list(df, end_block)

    altair_chart = (
        alt.Chart(df)
        .mark_bar()
        .encode(
            alt.X("amount:Q", bin=alt.Bin()),
            y="count()",
        )
    )

    st.altair_chart(altair_chart, use_container_width=True)
    return payment_list, df, program.get_summary(payment_list)
