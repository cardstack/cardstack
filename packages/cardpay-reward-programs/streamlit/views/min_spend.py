import streamlit as st
from cardpay_reward_programs.rules import MinSpend

from .utils import read_core_config, slider_partition


def min_spend(core_parameters):
    s = st.expander(label="User defined parameters", expanded=True)
    min_spend = s.number_input("Min Spend", value=150, step=1, min_value=0, max_value=5000)
    base_reward = s.number_input("Base reward", value=5, step=1, min_value=0, max_value=100)
    user_defined_parameters = {
        "base_reward": base_reward,
        "min_spend": min_spend,
        "token": "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
        "subgraph_config_location": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1/"
        },
        "duration": 43200,
    }
    rule = MinSpend(core_parameters, user_defined_parameters)
    read_core_config(rule)
    return rule


def view_multiple(core_parameters):
    program = min_spend(core_parameters)
    start_block, end_block = slider_partition(type="two_end")
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


def view_single(core_parameters):
    program = min_spend(core_parameters)
    block = slider_partition(type="one_end")
    end_block = block + program.payment_cycle_length
    df = program.run(block, end_block)
    payment_list = program.df_to_payment_list(df, end_block)
    return payment_list, df, program.get_summary(payment_list)
