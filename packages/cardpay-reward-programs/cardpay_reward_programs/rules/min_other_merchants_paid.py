import json

import numpy as np
import pandas as pd
from cardpay_reward_programs.rule import Rule


class MinOtherMerchantsPaid(Rule):
    """
    reward merchants who have paid at least n other merchants
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(MinOtherMerchantsPaid, self).__init__(core_parameters, user_defined_parameters)

    def sql(self, min_block, max_block):
        table_query = self._get_table_query("prepaid_card_payment", min_block, max_block)
        return f"""
        select 
        prepaid_card_owner as payee,
        merchant

        from {table_query}
        where block_number_uint64 >= ?::integer and block_number_uint64 < ?::integer and merchant != payee 
        """

    def sql_optim(self, min_block, max_block):
        table_query = self._get_table_query("prepaid_card_payment", min_block, max_block)
        return f"""                                                                                                                                                                                                                                                         
        select                                                                                                                                                                                                                                                              
        prepaid_card_owner as payee,                                                                                                                                                                                                                                        
        count(distinct merchant) as other_merchant_count                                                                                                                                                                                                                    
                                                                                                                                                                                                                                                                            
        from {table_query}                                                                                                                                                                                                                                                  
        where block_number_uint64 >= ?::integer and block_number_uint64 < ?::integer and merchant != payee                                                                                                                                                                  
        group by prepaid_card_owner                                                                                                                                                                                                                                         
        having(other_merchant_count) >= ?::integer                                                                                                                                                                                                                          
        """

    def df_to_payment_list(self, df, reward_program_id="0x"):
        new_df = df.copy().groupby("payee").agg({"merchant": "nunique"}).reset_index()
        new_df["rewardProgramID"] = reward_program_id
        new_df["validFrom"] = self.valid_from
        new_df["validTo"] = self.valid_to
        new_df["token"] = self.token
        new_df["amount"] = np.where(
            new_df["merchant"] >= self.min_other_merchants, self.base_reward, 0
        )
        new_df = new_df.drop(["merchant"], axis=1)
        return new_df[new_df["amount"] > 0]

    def run(self, payment_cycle: int):
        min_block = payment_cycle - self.payment_cycle_length
        max_block = payment_cycle
        vars = [min_block, max_block]
        return self.run_query(min_block, max_block, vars)

    def aggregate(self, cached_df=[]):
        return pd.concat(cached_df)
