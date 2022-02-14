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
                    "name": "Historical",
                    "view": programs.usage.view.view_historical,
                },
                {
                    "name": "Range",
                    "view": programs.usage.view.view_range,
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
default_config_root = "s3://tall-data-dev/subgraph_extraction/staging_rewards/0.0.1/"
config_location = st.sidebar.text_input("Config root", default_config_root)

if config_location:
    reward_ui["view"](config_location)
