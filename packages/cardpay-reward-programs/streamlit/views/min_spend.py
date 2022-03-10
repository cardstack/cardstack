import streamlit as st
from cardpay_reward_programs.rules import MinSpend

from .utils import read_attributes, slider_partition


def user_defined_parameters(config):
    s = st.expander(label="User defined parameters", expanded=True)
    min_spend = s.number_input("Min Spend", value=150, step=1, min_value=0, max_value=5000)
    base_reward = s.number_input("Base reward", value=5, step=1, min_value=0, max_value=100)
    user_defined_parameters = {
        "base_reward": base_reward,
        "min_spend": min_spend,
        "token": "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
        "subgraph_config_location": {"prepaid_card_payment": config["config_location"]},
        "duration": 43200,
    }
    return user_defined_parameters


def min_spend(core_parameters, config):
    user_parameters = user_defined_parameters(config)
    rule = MinSpend(core_parameters, user_parameters)
    read_attributes(rule)
    return rule


def view_multiple(core_parameters, config, view_config):
    program = min_spend(core_parameters, config)
    start_block, end_block = slider_partition(
        view_config["start_block"],
        view_config["end_block"],
        view_config["default_block"],
        type="two_end",
    )
    progress = st.progress(0.0)
    cached_df = []
    for i in range(start_block, end_block, program.payment_cycle_length):
        progress.progress((i - start_block) / (end_block - start_block))
        tail = min(end_block, i + program.payment_cycle_length)
        df = program.run(i, tail)
        if not df.empty:
            cached_df.append(df)
    df = program.aggregate(cached_df)
    payment_list = program.df_to_payment_list(df, end_block)
    return payment_list, df, program.get_summary(payment_list)


def view_single(core_parameters, config, view_config):
    program = min_spend(core_parameters, config)
    block = slider_partition(
        view_config["start_block"],
        view_config["end_block"],
        view_config["default_block"],
        type="one_end",
    )
    end_block = block + program.payment_cycle_length
    df = program.run(block, end_block)
    payment_list = program.df_to_payment_list(df, end_block)
    return payment_list, df, program.get_summary(payment_list)
