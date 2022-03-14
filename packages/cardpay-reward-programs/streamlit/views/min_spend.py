import streamlit as st
from cardpay_reward_programs.rules import MinSpend

def get_rule_class():
    return MinSpend

def get_user_defined_parameters():
    s = st.expander(label="User defined parameters", expanded=True)
    min_spend = s.number_input("Min Spend", value=150, step=1, min_value=0, max_value=5000)
    base_reward = s.number_input("Base reward", value=5, step=1, min_value=0, max_value=100)
    user_defined_parameters = {
        "base_reward": base_reward,
        "min_spend": min_spend,
        "token": "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E",
        "subgraph_config_location": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data//data/prepaid_card_payments/0.0.3/"
        },
        "duration": 43200,
    }
    return user_defined_parameters