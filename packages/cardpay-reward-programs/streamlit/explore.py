import os

import streamlit as st
from boto3.session import Session
from cardpay_reward_programs.utils import check_env
from cloudpathlib import S3Client
from dotenv import load_dotenv
from views import min_other_merchants_paid, min_spend, retro_airdrop, weighted_usage
from views.config import view_config_map
from views.core_parameters import core_parameters
from views.utils import download_csv

load_dotenv()
check_env()

cached_client = S3Client(
    local_cache_dir="mycache",
    boto3_session=Session(
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    ),
)
cached_client.set_as_default_client()
view_config = view_config_map[os.getenv("APP")]


st.set_page_config(page_title="Rule Configurator", layout="wide")
st.header("Rule Configurator")

o = {
    "min_spend": {
        # env depenedent configs
        "config": {
            "staging": {
                "config_location": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            },
            "prod": {
                "config_location": "s3://cardpay-production-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            },
        },
        "view": {"single": min_spend.view_single, "multiple": min_spend.view_multiple},
    },
    "min_other_merchants_paid": {
        "config": {
            "staging": {
                "config_location": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            },
            "prod": {
                "config_location": "s3://cardpay-production-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            },
        },
        "view": {
            "single": min_other_merchants_paid.view_single,
            "multiple": min_other_merchants_paid.view_multiple,
        },
    },
    "weighted_usage": {
        "config": {
            "staging": {
                "config_location": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            },
            "prod": {
                "config_location": "s3://cardpay-production-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            },
        },
        "view": {
            "single": weighted_usage.view_single,
            "multiple": weighted_usage.view_multiple,
        },
    },
    "retro_airdrop": {
        "config": {
            "staging": {
                "config_location": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            },
            "prod": {
                "config_location": "s3://cardpay-production-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            },
        },
        "view": {"single": retro_airdrop.view_single},
    },
}
rule_name = st.sidebar.selectbox(
    "Rule", ("min_spend", "min_other_merchants_paid", "weighted_usage", "retro_airdrop")
)
v = st.sidebar.selectbox("view", ("single", "multiple"))


core = core_parameters(rule_name)

f = o[rule_name]["view"][v]
config = o[rule_name]["config"][os.getenv("APP")]

payment_list, df, summary = f(core, config, view_config)
st.table(df)
st.write(summary)
st.write(payment_list)
download_csv(payment_list)
