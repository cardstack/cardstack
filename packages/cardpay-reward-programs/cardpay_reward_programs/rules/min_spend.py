import numpy as np
import pandas as pd
from cardpay_reward_programs.config import default_payment_list
from cardpay_reward_programs.rule import Rule


class MinSpend(Rule):
    def __init__(self, core_parameters, user_defined_parameters):
        super(MinSpend, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self, min_spend, base_reward, token, duration
    ):
        self.min_spend = min_spend
        self.base_reward = base_reward
        self.token = token
        self.duration = duration

    def sql(self, table_query):
        return f"""
        select 
        prepaid_card_owner as payee,
        sum(spend_amount_uint64) as total_spent

        from {table_query}
        where block_number_uint64 > $1::integer and block_number_uint64 <= $2::integer 
        
        group by prepaid_card_owner
        having(total_spent) >= $3::integer
        """

    def df_to_payment_list(
        self, df, payment_cycle, reward_program_id
    ):
        if df.empty:
            return default_payment_list.copy()
        new_df = df.copy()
        new_df["rewardProgramID"] = reward_program_id
        new_df["paymentCycle"] = payment_cycle
        new_df["validFrom"] = payment_cycle
        new_df["validTo"] = payment_cycle + self.duration
        new_df["token"] = self.token
        new_df["amount"] = np.where(new_df["total_spent"] > self.min_spend, self.base_reward, 0)
        new_df = new_df.drop(["total_spent"], axis=1)
        return new_df[new_df["amount"] > 0].reset_index()

    def run(self, payment_cycle: int, reward_program_id: str):
        start_block, end_block = payment_cycle - self.payment_cycle_length, payment_cycle
        vars = [start_block, end_block, self.min_spend]
        table_query = self._get_table_query("prepaid_card_payment", "prepaid_card_payment", start_block, end_block)
        if table_query == "parquet_scan([])":
            base_df = pd.DataFrame(columns=["payee", "total_spent"])
        else:
            base_df = self.run_query(table_query, vars)
        return self.df_to_payment_list(base_df, payment_cycle, reward_program_id)

    def aggregate(self, cached_df=[]):
        if len(cached_df) == 0:
            return pd.DataFrame(columns=["payee", "total_spent"])
        else:
            return pd.concat(cached_df).groupby("payee").sum().reset_index()
