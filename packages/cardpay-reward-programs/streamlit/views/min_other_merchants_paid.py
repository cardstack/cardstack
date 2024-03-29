import streamlit as st
from cardpay_reward_programs.rules import MinOtherMerchantsPaid


def get_rule_class():
    return MinOtherMerchantsPaid


def get_user_defined_parameters():
    s = st.expander(label="User defined parameters", expanded=True)
    min_other_merchants = s.number_input(
        "Min Other Merchants", value=1, step=1, min_value=0, max_value=20
    )
    base_reward = s.number_input(
        "Base reward", value=5, step=1, min_value=0, max_value=100
    )

    user_defined_parameters = {
        "base_reward": base_reward,
        "min_other_merchants": min_other_merchants,
        "token": "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
        "duration": 43200,
    }
    return user_defined_parameters
