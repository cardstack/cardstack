import streamlit as st
from cardpay_reward_programs.config import default_core_config


def core_parameters(rule_name):
    s = st.expander(label="Core parameters")
    payment_cycle_length = s.selectbox("Payment Cycle Length", (524288, 327698, 1024))
    core_parameters = default_core_config.copy()
    core_parameters.update({"docker_image": rule_name})
    core_parameters.update({"payment_cycle_length": int(payment_cycle_length)})
    return core_parameters
