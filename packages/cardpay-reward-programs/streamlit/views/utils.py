import streamlit as st
from cardpay_reward_programs.config import default_core_config


def read_core_config(rule):
    r = st.expander(label="Rule config")
    for key in default_core_config.keys():
        r.write(f"{key}={getattr(rule,key)}")


def slider_partition(
    min_block=24117248, max_block=25117248, default_block=24150016, type="two-end"
):
    if type == "two_end":
        start, end = st.slider(
            "Start block - End block",
            min_value=min_block,
            max_value=max_block,
            value=(min_block, 25000000),
        )
        return (start, end)
    elif type == "one_end":
        block = st.slider(
            "End block", min_value=min_block, max_value=max_block, value=default_block
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
