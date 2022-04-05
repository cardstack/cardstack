import streamlit as st
from cardpay_reward_programs.rules import MinOtherMerchantsPaid
from cardpay_reward_programs.config import reward_token_addresses

def get_rule_class():
    return MinOtherMerchantsPaid

def get_core_parameters():
    core_parameters = {
        "start_block": 20000000,
        "end_block": 26000000,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data//data/prepaid_card_payments/0.0.3/"
        },
    }
    return core_parameters

def get_user_defined_parameters():
    s = st.expander(label="User defined parameters", expanded=True)
    min_other_merchants = s.number_input(
        "Min Other Merchants", value=1, step=1, min_value=0, max_value=20
    )
    base_reward = s.number_input("Base reward", value=5, step=1, min_value=0, max_value=100)

    user_defined_parameters = {
        "base_reward": base_reward,
        "min_other_merchants": min_other_merchants,
        "token": reward_token_addresses["xdai"],
        "duration": 43200,
    }
    return user_defined_parameters
