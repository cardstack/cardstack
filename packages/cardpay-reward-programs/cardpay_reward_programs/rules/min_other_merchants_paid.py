import numpy as np
import pandas as pd
from cardpay_reward_programs.config import (default_payment_list,
                                            reward_token_addresses)
from cardpay_reward_programs.rule import Rule


class MinOtherMerchantsPaid(Rule):
    """
    reward merchants who have paid at least n other merchants
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(MinOtherMerchantsPaid, self).__init__(
            core_parameters, user_defined_parameters
        )

    def set_user_defined_parameters(
        self, min_other_merchants, base_reward, token, duration
    ):
        self.min_other_merchants = min_other_merchants
        self.base_reward = base_reward
        self.token = token
        self.duration = duration

    def sql(self, table_query):
        return f"""
        select
        prepaid_card_owner as payee,
        merchant

        from {table_query}
        where block_number_uint64 > $1::integer and block_number_uint64 <= $2::integer and merchant != payee
        """

    def df_to_payment_list(self, df, payment_cycle, reward_program_id):
        if df.empty:
            return default_payment_list
        new_df = df.copy().groupby("payee").agg({"merchant": "nunique"}).reset_index()
        new_df["rewardProgramID"] = reward_program_id
        new_df["paymentCycle"] = payment_cycle
        new_df["validFrom"] = payment_cycle
        new_df["validTo"] = payment_cycle + self.duration
        new_df["token"] = self.token
        new_df["amount"] = np.where(
            new_df["merchant"] >= self.min_other_merchants, self.base_reward, 0
        )
        new_df = new_df.drop(["merchant"], axis=1)
        return new_df[new_df["amount"] > 0]

    def run(self, payment_cycle: int, reward_program_id: str):
        start_block, end_block = (
            payment_cycle - self.payment_cycle_length,
            payment_cycle,
        )
        vars = [start_block, end_block]
        table_query = self._get_table_query(
            "prepaid_card_payment", "prepaid_card_payment", start_block, end_block
        )
        if table_query == "parquet_scan([])":
            base_df = pd.DataFrame(columns=["payee", "merchant"])
        else:
            base_df = self.run_query(table_query, vars)
        return self.df_to_payment_list(base_df, payment_cycle, reward_program_id)
