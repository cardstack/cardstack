import streamlit as st
from boto3.session import Session
from cloudpathlib import S3Client
from cardpay_reward_programs.rules import *
from views import min_other_merchants_paid, min_spend, weighted_usage
from views.utils import *

cached_client = S3Client(local_cache_dir="mycache", boto3_session=Session())
cached_client.set_as_default_client()

st.set_page_config(page_title="Rule Configurator", layout="wide")
st.header("Rule Configurator")

rules_modules = {
    "min_spend": min_spend,
    "min_other_merchants_paid": min_other_merchants_paid,
    "weighted_usage": weighted_usage
}

view_functions = {
    "single": view_single,
    "multiple": view_multiple
}

rule_module_name = st.sidebar.selectbox("Rule", rules_modules.keys())
rule_module = rules_modules[rule_module_name]

view_function_name = st.sidebar.selectbox("view", ["single", "multiple"])
view_function = view_functions[view_function_name]

s = st.expander(label="Core parameters")
payment_cycle_length = s.number_input(
    "Payment cycle length",
    value=1024 * 32,
    step=1024,
    min_value=1024,
    max_value=1024 * 128,
)

core_parameters = {
    "start_block": 20000000,
    "end_block": 26000000,
    "payment_cycle_length": int(payment_cycle_length)
}

user_defined_parameters = rule_module.get_user_defined_parameters()

rule = rule_module.get_rule_class()(core_parameters, user_defined_parameters)

payment_list, summary = view_function(rule)
st.write(summary)
st.write(payment_list)
download_csv(payment_list)