import streamlit as st

import programs.usage.view

st.header("Reward program exploration")

reward_program = st.sidebar.selectbox(
    "Reward Program",
    [
        {
            "name": "CardPay Usage",
            "view_functions": [
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
config_location = st.sidebar.text_input("Config root", "")

if config_location:
    reward_ui["view"](config_location)
