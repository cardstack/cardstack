import json

import pandas as pd
from cardpay_reward_programs.rule import Rule


class WeightedUsage(Rule):
    def __init__(self, core_parameters, user_defined_parameters):
        super(WeightedUsage, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self, base_reward: int, transaction_factor: int, spend_factor: int
    ):
        self.base_reward = base_reward
        self.transaction_factor = transaction_factor
        self.spend_factor = spend_factor

    def sql(self, min_block, max_block):
        table_query = self._get_table_query("prepaid_card_payment", min_block, max_block)
        return f"""
        select
        prepaid_card_owner as payee,

        (? *
        1 + (1-(percent_rank() over (order by sum(spend_amount_uint64)  desc))) * (?)
        *
        1 + (1-(percent_rank() over (order by count(*)  desc))) * (?))::integer as amount,

        count(*) as transactions,
        sum(spend_amount_uint64) as total_spent

        from {table_query}
        where block_number_uint64 >= ?::integer and block_number_uint64 < ?::integer 
        group by prepaid_card_owner
        order by transactions desc
        """

    def df_to_payment_list(self, df, reward_program_id="0x"):
        new_df = df.copy()
        new_df = new_df[["payee", "amount"]].groupby("payee").sum().reset_index()
        new_df["rewardProgramID"] = reward_program_id
        new_df["validFrom"] = self.valid_from
        new_df["validTo"] = self.valid_to
        new_df["token"] = self.token
        return new_df[new_df["amount"] > 0]

    def run(self, payment_cycle: int):
        min_block = payment_cycle - self.payment_cycle_length
        max_block = payment_cycle
        vars = [self.base_reward, self.spend_factor, self.transaction_factor, min_block, max_block]
        return self.run_query(min_block, max_block, vars)

    def aggregate(self, cached_df=[]):
        return pd.concat(cached_df)
