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


def slider_partition(
    start_block=24117248, end_block=25117248, default_block=24150016, type="two-end"
):
    if type == "two_end":
        start, end = st.slider(
            "Start block - End block",
            min_value=start_block,
            max_value=end_block,
            value=(start_block, 25000000),
        )
        return (start, end)
    elif type == "one_end":
        block = st.slider(
            "End block", min_value=start_block, max_value=end_block, value=default_block
        )
        return block
    else:
        raise Exception("Not recognized type for custom slider input")


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


def block_to_timestamp_converter(w3, block_min):
    block = st.number_input(label="block", min_value=block_min)
    t = get_timestamp(w3, block)
    st.write(datetime.utcfromtimestamp(t).strftime("%Y-%m-%d %H:%M:%S"))
    st.write(t)


def get_timestamp(w3, block):
    block = w3.eth.get_block(block)
    t = block.timestamp
    print(datetime.utcfromtimestamp(t).strftime("%Y-%m-%d %H:%M:%S"))
    return t
