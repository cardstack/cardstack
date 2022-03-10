import streamlit as st
from cardpay_reward_programs.rules import RetroAirdrop

from .utils import block_to_timestamp_converter, read_attributes, slider_partition


def user_defined_parameters(config):
    s = st.expander(label="User defined parameters", expanded=True)
    total_reward = s.number_input(
        "total reward", value=10000000, step=1000000, min_value=1000000, max_value=50000000
    )
    start_snapshot_block = s.number_input(
        "start_snapshot_block", value=17265698, step=10, min_value=1000000, max_value=50000000
    )
    end_snapshot_block = s.number_input(
        "end_snapshot_block", value=25165824, step=10, min_value=1000000, max_value=50000000
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
