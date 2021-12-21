import streamlit as st
import pandas as pd
from .process import UsageRewardProgram

import altair as alt

def create_program(config):

    reward_program_id = "test_reward"
    token = "test_token"

    payment_cycle_length = st.number_input('Payment cycle length', value=1024*32, step=1024, min_value=1024, max_value=1024*128)
    base_reward = st.number_input('Base reward', value=5, step=1, min_value=0, max_value=100)
    transaction_factor = st.number_input('Transaction factor', value=2.0, step=0.1, min_value=0.0, max_value=10.0)
    spend_factor = st.number_input('Spend factor', value=2.0, step=0.1, min_value=0.0, max_value=10.0)

    program = UsageRewardProgram(config, reward_program_id, payment_cycle_length)
    program.set_parameters(token, base_reward, transaction_factor, spend_factor, 100000)
    return program

def view_historical(config):
    st.write("This program is designed to reward end users for making payments across the network")
    min_block = 18000000
    min_block, max_block = st.slider('End block',  min_value = min_block, max_value=19382272, value=(18500000, 19000000))

    program = create_program(config)

    progress = st.progress(0.0)
    payments = []
    for i in range(min_block, max_block , program.payment_cycle_length):
        progress.progress((i - min_block) / (max_block - min_block))
        df = program.run(i)
        payments.append({
            "block": i,
            "amount": df["amount"].sum()
        })

    historical = pd.DataFrame(payments)
    st.write(historical)
    amount_each_cycle = alt.Chart(historical).mark_bar().encode(
        alt.X("block"),
        y='amount',
    )

    st.altair_chart(amount_each_cycle, use_container_width=True)
    amounts = alt.Chart(historical).mark_bar().encode(
        alt.X("amount:Q", bin=alt.Bin()),
        y='count()',
    )

    st.altair_chart(amounts, use_container_width=True)

    return

def view_range(config):
    st.write("This program is designed to reward end users for making payments across the network")
    min_block = 17350154
    max_block = st.slider('End block',  min_value = min_block, max_value=19382272, value=19000000)

    program = create_program(config)

    df = program.run(max_block)

    st.write(df)

    altair_chart = alt.Chart(df).mark_bar().encode(
        alt.X("amount:Q", bin=alt.Bin()),
        y='count()',
    )

    st.altair_chart(altair_chart, use_container_width=True)
