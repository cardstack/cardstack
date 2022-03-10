import streamlit as st
from cardpay_reward_programs.config import default_core_config


def core_parameters(rule_name):
    s = st.expander(label="Core parameters")
    payment_cycle_length = s.number_input(
        "Payment cycle length",
        value=1024 * 32,
        step=1024,
        min_value=1024,
        max_value=1024 * 128,
    )

    core_parameters = default_core_config.copy()
    core_parameters.update({"docker_image": rule_name})
    core_parameters.update({"payment_cycle_length": int(payment_cycle_length)})
    return core_parameters
