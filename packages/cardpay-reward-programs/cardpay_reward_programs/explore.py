import numpy as np
import programs.usage.view
import streamlit as st

st.header("Reward program exploration")

reward_program = st.sidebar.selectbox(
    "Reward Program",
    [
        {
            "name": "CardPay Usage",
            "view_functions": [
                {
                    "name": "Query",
                    "view": programs.usage.view.view_query,
                },
                {
                    "name": "Range",
                    "view": programs.usage.view.view_range,
                },
                {
                    "name": "Historical",
                    "view": programs.usage.view.view_historical,
                },
            ],
        }
    ],
    format_func=lambda x: x["name"],
    key="name",
)
reward_ui = st.sidebar.selectbox(
    "View",
    reward_program["view_functions"],
    format_func=lambda x: x["name"],
)

root_prefix = "s3://cardpay-staging-partitioned-graph-data/data/"
config_roots = tuple(["staging_rewards/0.0.1/", "prepaid_card_payments/0.0.2/", "rewards/0.0.1/"])

config_choice = st.sidebar.selectbox("Config root", config_roots)
config_location = f"{root_prefix}{config_choice}"


st.write("Current config location", config_location)
if config_location:
    reward_ui["view"](config_location)
