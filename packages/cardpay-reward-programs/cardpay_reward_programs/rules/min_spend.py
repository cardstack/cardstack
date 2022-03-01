import hashlib
import json

import numpy as np
import pandas as pd
from cardpay_reward_programs.rule import Rule


class MinSpend(Rule):
    def __init__(self, core_parameters, user_defined_parameters):
        super(MinSpend, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(self, min_spend, base_reward):
        self.min_spend = min_spend
        self.base_reward = base_reward

    def get_user_defined_hash(self):
        user_defined_parameters = {
            "base_reward": self.base_reward,
            "min_spend": self.min_spend,
        }
        o = json.dumps(user_defined_parameters, sort_keys=True)
        return hashlib.md5(o.encode("utf-8")).hexdigest()

    def sql(self, min_block, max_block):
        table_query = self._get_table_query("prepaid_card_payment", min_block, max_block)
        return f"""
        select 
        prepaid_card_owner as payee,
        sum(spend_amount_uint64) as total_spent

        from {table_query}
        where block_number_uint64 >= ?::integer and block_number_uint64 < ?::integer 
        
        group by prepaid_card_owner
        having(total_spent) >= ?::integer
        """

    def df_to_payment_list(self, df, reward_program_id="0x"):
        new_df = df.copy()
        new_df["rewardProgramID"] = reward_program_id
        new_df["validFrom"] = self.valid_from
        new_df["validTo"] = self.valid_to
        new_df["token"] = self.token
        new_df["amount"] = np.where(new_df["total_spent"] > self.min_spend, self.base_reward, 0)
        new_df = new_df.drop(["total_spent"], axis=1)
        return new_df[new_df["amount"] > 0]

    def run(self, payment_cycle: int):
        min_block = payment_cycle - self.payment_cycle_length
        max_block = payment_cycle
        vars = [min_block, max_block, self.min_spend]
        return self.run_query(min_block, max_block, vars)

    def aggregate(self, cached_df=[]):
        return pd.concat(cached_df).groupby("payee").sum().reset_index()
