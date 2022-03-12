import streamlit as st
from cardpay_reward_programs.config import default_core_config
import pandas as pd

def read_core_config(rule):
    r = st.expander(label="Rule config")
    for key in default_core_config.keys():
        r.write(f"{key}={getattr(rule,key)}")


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


def view_multiple(program):
    start_block, end_block = slider_partition(type="two_end")
    progress = st.progress(0.0)
    payment_lists = []
    for i in range(start_block, end_block, program.payment_cycle_length):
        progress.progress((i - start_block) / (end_block - start_block))
        tail = min(end_block, i + program.payment_cycle_length)
        payment_list = program.run(tail, "0x0")
        if not payment_list.empty:
            payment_lists.append(payment_list)
    combined_payment_list = pd.concat(payment_lists)
    return combined_payment_list, program.get_summary(combined_payment_list)


def view_single(program):
    block = slider_partition(type="one_end")
    payment_list = program.run(block, "0x0")
    return payment_list, program.get_summary(payment_list)