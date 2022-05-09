import streamlit as st
import pandas as pd
from eth_abi import decode_abi
from hexbytes import HexBytes


@st.cache
def convert_df(df):
    return df.to_csv().encode('utf-8')

st.header("Inspect computed payment lists")

decimals = st.number_input("Decimals for token", value=18)

results_file = st.file_uploader("Upload parquet file", type="parquet")
if results_file is not None:
    results_df = pd.read_parquet(results_file)
    results_list = results_df.to_records('dict')
    payments = []
    for result in results_list:
        (rewardProgramID,
                paymentCycle,
                validFrom,
                validTo,
                tokenType,
                payee,
                transferData) =  decode_abi(
            ["address", "uint256", "uint256", "uint256", "uint256", "address", "bytes"], HexBytes(result['leaf']))
        if tokenType == 1:
            token, amount = decode_abi(["address", "uint256"], transferData)
            payments.append({
                "amount": amount / (10**decimals),
                "payee": payee,
                "token": token,
            })
    payments_df = pd.DataFrame.from_records(payments)
    st.write(payments_df)


    csv = convert_df(payments_df)

    st.download_button(
        "Press to Download",
        csv,
        "payment_list.csv",
        "text/csv",
        key='download-csv'
    )
    st.write("Total payment: ", payments_df.amount.sum())
    st.write("Total payees: ", payments_df.payee.count())