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
        interest_rate_monthly
    ):
        self.token = token
        self.duration = duration
        self.interest_rate_monthly = interest_rate_monthly 

    def sql(self, table_query, aux_table_query): 
        token_holder_table = table_query
        safe_owner_table = aux_table_query
        
        return  f"""
            with compound_parameters as (select th._block_number, so.owner, th.safe, th.balance_uint64,
                lag(th.balance_uint64) over (partition by th.safe order by th._block_number asc NULLS LAST) as old_balance,
                th.balance_uint64 - lag(th.balance_uint64) over (partition by th.safe order by th._block_number asc NULLS LAST) as change,
                $1::integer as start_block, $2::integer as end_block,  $2::integer - th._block_number::integer as blocks_to_finish
                from {token_holder_table} as th, {safe_owner_table} as so
                where th._block_number::integer >= $1::integer
                and th._block_number::integer < $2::integer
                and th.token = 'card'
                and th.safe = so.safe
                and th.safe is not null
                ),

            partial_rewards as (select * ,(blocks_to_finish::float/$4::float) as percentage_of_month, 
                (blocks_to_finish::float/$4::float) * $5::float as interest_rate,
                (blocks_to_finish::float/$4::float) * $5::float * change as partial_reward
                from compound_parameters),
        
            base_rewards as (select distinct on (safe) safe, owner, balance_uint64, blocks_to_finish, percentage_of_month, interest_rate,
                ((blocks_to_finish::float/$4::float) * $5::float) * balance_uint64 as base_reward
                from partial_rewards),

            agg_partial_rewards as (select safe, Sum(partial_reward) as intermediate_rewards 
                from partial_rewards group by safe order by safe)

            select br.owner as payee, br.base_reward + coalesce(agr.intermediate_rewards, 0) as rewards
                from base_rewards as br, agg_partial_rewards as agr 
                where br.safe = agr.safe;
        """        

    def run(self, payment_cycle: int, reward_program_id:str): 
        start_block, end_block = payment_cycle - self.payment_cycle_length, payment_cycle
        vars = [
            start_block, # $1 -> int
            end_block, # $2 -> int
            self.token, # $3 -> str
            self.payment_cycle_length, # $4 -> int
            self.interest_rate_monthly # $5 -> float
        ]

        table_query = self._get_table_query(
            "token_holder", 
            "token_holder", 
            self.start_block,
            self.end_block
        )

        aux_table_query = self._get_table_query(
            "safe_owner", 
            "safe_owner",
            self.start_block,
            self.end_block
        )

        df = self.run_query(table_query, vars, aux_table_query)
    
        df["rewardProgramID"] = reward_program_id
        df["paymentCycle"] = payment_cycle
        df["validFrom"] = payment_cycle
        df["validTo"] = payment_cycle + self.duration
        df["token"] = self.token
        df["amount"] = df["rewards"]
        df.drop(["rewards"], axis=1)
        return df


    



        