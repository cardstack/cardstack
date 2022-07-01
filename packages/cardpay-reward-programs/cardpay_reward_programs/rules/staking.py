from cardpay_reward_programs.rule import Rule
import pandas as pd

class Staking(Rule):
    """
        This rule rewards users with CARD.cpxd held in a depot in a monthly basis 
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(Staking, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self,
        token,
        duration,
        num_of_blocks_per_month,
        interest_rate_monthly
    ):
        self.token = token
        self.duration = duration
        self.num_of_blocks_per_month = num_of_blocks_per_month #518400
        self.interest_rate_monthly = interest_rate_monthly #0.48

    def sql(self, table_query): 
        #THIS FUNCTION IS TO COMPLY WITH THE ABSTRACT METHODS OF rule.py BUT IT IS TEMPORAL
        pass

    def sql_2(self):

        token_holder_table = self._get_table_query(
            "token_holder",
            "token_holder",
            self.start_block,
            self.end_block
        )

        safe_owner_table = self._get_table_query(
            "safe_owner", 
            "safe_owner",
            self.start_block,
            self.end_block
        )

        return  f"""
            select lower(block_range), upper(block_range), safe, balance,
                lag(balance) over (partition by safe order by upper(block_range) asc NULLS LAST) as old_balance,
                balance - lag(balance) over (partition by safe order by upper(block_range) asc NULLS LAST) as change,
                first_value(lower(block_range)) over (partition by safe order by lower(block_range) asc) as star_block,
                518400 + first_value(lower(block_range)) over (partition by safe order by lower(block_range) asc) as end_block,
                (518400 + first_value(lower(block_range)) over (partition by safe order by lower(block_range) asc)) - lower(block_range) as blocks_to_finish,
                balance * 2 as compound
                from sgd1.token_holder 
                where token = '0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3'
                and safe is not null
                ;
        """

    def run(self, payment_cycle: int, reward_program_id:str): 
        vars = [
            self.start_block,
            self.end_block,
            self.token
        ]

        tables_names = ["token_holder", "safe_owner"]

        df = self.run_query(tables_names, vars)

        df["rewardProgramID"] = reward_program_id
        df["paymentCycle"] = payment_cycle
        df["validFrom"] = payment_cycle
        df["validTo"] = payment_cycle + self.duration
        df["token"] = self.token
        df["amount"] = df["rewards"]
        df.drop(["rewards"], axis=1)
        return df




        