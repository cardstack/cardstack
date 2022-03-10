import streamlit as st
from cardpay_reward_programs.rules import MinOtherMerchantsPaid

from .utils import read_attributes


def user_defined_parameters(config):
    s = st.expander(label="User defined parameters", expanded=True)
    min_other_merchants = s.number_input(
        "Min Other Merchants", value=1, step=1, min_value=0, max_value=20
    )
    base_reward = s.number_input("Base reward", value=5, step=1, min_value=0, max_value=100)
    user_defined_parameters = {
        "base_reward": base_reward,
        "min_other_merchants": min_other_merchants,
        "token": config["token"],
        "subgraph_config_location": {"prepaid_card_payment": config["config_location"]},
        "duration": 43200,
    }
    return user_defined_parameters


def min_other_merchants_paid(core_parameters, config):
    user_parameters = user_defined_parameters(config)
    rule = MinOtherMerchantsPaid(core_parameters, user_parameters)
    read_attributes(rule)
    return rule


def view_multiple(core_parameters, config, view_config):
    program = min_other_merchants_paid(core_parameters, config)
    start_block, end_block = st.slider(
        "Start block - End block",
        min_value=view_config["start_block"],
        max_value=view_config["end_block"],
        value=(view_config["start_block"], view_config["default_block"]),
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
    program = min_other_merchants_paid(core_parameters, config)
    block = st.slider(
        "End block",
        min_value=view_config["start_block"],
        max_value=view_config["end_block"],
        value=view_config["default_block"],
    )
    end_block = block + program.payment_cycle_length
    df = program.run(block, end_block)
    payment_list = program.df_to_payment_list(df, end_block)

    return payment_list, df, program.get_summary(payment_list)
