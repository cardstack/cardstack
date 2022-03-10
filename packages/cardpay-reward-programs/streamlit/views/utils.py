import datetime

import streamlit as st
from cardpay_reward_programs.config import default_core_config


def read_core_config(rule):
    r = st.expander(label="Rule config")
    for key in default_core_config.keys():
        r.write(f"{key}={getattr(rule,key)}")


def read_attributes(rule):
    r = st.expander(label="Rule config")
    for attribute, value in rule.__dict__.items():
        r.write(f"{attribute}={value}")


def to_csv(df):
    return df.to_csv().encode("utf-8")


def download_csv(payment_list):
    csv = to_csv(payment_list)
    st.download_button(
        label="Download payment list",
        data=csv,
        file_name="payment_list.csv",
        mime="text/csv",
    )
