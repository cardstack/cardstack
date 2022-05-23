from cardpay_reward_programs.rule import Rule
import pandas as pd


class SafeOwnership(Rule):
    """
    This rule rewards the ownwership of a specific safe type with a fixed reward per safe, with a cap.
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(SafeOwnership, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self,
        reward_per_safe,
        token,
        duration,
        start_analysis_block,
        safe_type,
        max_rewards,
    ):
        self.token = token
        self.duration = duration
        self.reward_per_safe = reward_per_safe
        self.start_analysis_block = start_analysis_block
        self.safe_type = safe_type
        self.max_rewards = max_rewards

    def sql(self, table_query):
        return f"""
        with total_safes as (select 
                owner as payee,
                count(distinct safe) as total_safe_count
                from {table_query}
                where _block_number > $1::integer and _block_number <= $2::integer
                and type = $4::text
                group by owner
                ),
            new_safes as (select 
                owner as payee,
                count(distinct safe) as new_safe_count
                from {table_query}
                where _block_number > ($2 - $3) and _block_number <= $2::integer
                and type = $4::text
                group by owner
            )
        select new_safes.payee as payee,
        -- Reward is the least out of remaining allowed rewards and the total number of new safes
        least($5 - total_safe_count + new_safe_count, new_safe_count) as payable_safes
        from new_safes
        left join total_safes on total_safes.payee = new_safes.payee
        where payable_safes > 0
        """

    def run(self, payment_cycle: int, reward_program_id: str):
        vars = [
            self.start_analysis_block,
            payment_cycle,
            self.payment_cycle_length,
            self.safe_type,
            self.max_rewards,
        ]
        table_query = self._get_table_query(
            "safe_owner", "safe_owner", self.start_analysis_block, payment_cycle
        )
        if table_query == "parquet_scan([])":
            df = pd.DataFrame(columns=["payee", "payable_safes"])
        else:
            df = self.run_query(table_query, vars)
        df["rewardProgramID"] = reward_program_id
        df["paymentCycle"] = payment_cycle
        df["validFrom"] = payment_cycle
        df["validTo"] = payment_cycle + self.duration
        df["token"] = self.token
        df["amount"] = df["payable_safes"] * self.reward_per_safe
        df = df.drop(["payable_safes"], axis=1)
        return df
