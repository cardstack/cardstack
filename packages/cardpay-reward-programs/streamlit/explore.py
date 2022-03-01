import streamlit as st
from views import min_other_merchants_paid, min_spend, weighted_usage
from views.core_parameters import core_parameters
from views.utils import download_csv

st.set_page_config(page_title="Rule Configurator", layout="wide")
st.header("Rule Configurator")

o = {
    "min_spend": {"single": min_spend.view_single, "multiple": min_spend.view_multiple},
    "min_other_merchants_paid": {
        "single": min_other_merchants_paid.view_single,
        "multiple": min_other_merchants_paid.view_multiple,
    },
    "weighted_usage": {
        "single": weighted_usage.view_single,
        "multiple": weighted_usage.view_multiple,
    },
}

rule = st.sidebar.selectbox("Rule", ("min_spend", "min_other_merchants_paid", "weighted_usage"))
v = st.sidebar.selectbox("view", ("single", "multiple"))

core = core_parameters()

f = o[rule][v]
payment_list, df, summary = f(core)
st.table(df)
st.write(summary)
st.write(payment_list)
download_csv(payment_list)
