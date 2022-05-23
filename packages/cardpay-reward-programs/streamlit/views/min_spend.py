import streamlit as st
from cardpay_reward_programs.config import config
from cardpay_reward_programs.rules import MinSpend


def get_rule_class():
    return MinSpend


def get_user_defined_parameters(environment="staging"):
    s = st.expander(label="User defined parameters", expanded=True)
    min_spend = s.number_input(
        "Min Spend", value=150, step=1, min_value=0, max_value=5000
    )
    base_reward = s.number_input(
        "Base reward", value=5, step=1, min_value=0, max_value=100
    )
    user_defined_parameters = {
        "base_reward": base_reward,
        "min_spend": min_spend,
        "token": config[environment]["tokens"]["card"],
        "duration": 43200,
    }
    return user_defined_parameters
