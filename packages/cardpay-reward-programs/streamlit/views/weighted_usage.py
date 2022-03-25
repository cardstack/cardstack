import streamlit as st
from cardpay_reward_programs.config import reward_token_addresses
from cardpay_reward_programs.rules import WeightedUsage


def get_rule_class():
    return WeightedUsage


def get_user_defined_parameters():
    s = st.expander(label="User defined parameters", expanded=True)
    base_reward = s.number_input(
        "Base reward", value=5, step=1, min_value=0, max_value=100
    )
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
        "token": reward_token_addresses["xdai"],
        "subgraph_config_location": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data//data/prepaid_card_payments/0.0.3/"
        },
        "duration": 43200,
    }
    return user_defined_parameters
