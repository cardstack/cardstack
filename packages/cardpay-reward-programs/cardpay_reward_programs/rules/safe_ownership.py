from cardpay_reward_programs.rule import Rule
from cardpay_reward_programs.utils import get_table_dataset


class SafeOwnership(Rule):
    """
    This rule rewards the ownwership of a specific safe type with a fixed reward per safe, with a cap.
    """

    def __init__(
        self,
        core_parameters,
        user_defined_parameters,
        explanation_block={},
        metadata={},
    ):
        super(SafeOwnership, self).__init__(
            core_parameters, user_defined_parameters, explanation_block, metadata
        )

    def set_user_defined_parameters(
        self,
        reward_per_safe,
        token,
        start_analysis_block,
        safe_type,
        max_rewards,
    ):
        self.token = token
        self.reward_per_safe = int(reward_per_safe)
        self.start_analysis_block = start_analysis_block
        self.safe_type = safe_type
        self.max_rewards = max_rewards

    def register_tables(self):
        safe_owner = get_table_dataset(
            self.subgraph_config_locations["safe_owner"], "safe_owner"
        )
        self.connection.register("safe_owner", safe_owner)

    def sql(self):
        return """
        with total_safes as (select
                owner as payee,
                count(distinct safe) as total_safe_count
                from safe_owner
                where _block_number > $1::integer and _block_number <= $2::integer
                and type = $4::text
                group by owner
                ),
            new_safes as (select
                owner as payee,
                count(distinct safe) as new_safe_count
                from safe_owner
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
        self.register_tables()
        vars = [
            self.start_analysis_block,
            payment_cycle,
            self.payment_cycle_length,
            self.safe_type,
            self.max_rewards,
        ]
        df = self.connection.execute(self.sql(), vars).fetch_df()
        df["rewardProgramID"] = reward_program_id
        df["paymentCycle"] = payment_cycle
        df["validFrom"] = payment_cycle
        df["validTo"] = payment_cycle + self.duration
        df["token"] = self.token
        df["amount"] = df["payable_safes"] * self.reward_per_safe
        df = df.drop(["payable_safes"], axis=1)
        return df

    def get_explanation_data_arr(self, payment_list):
        explanation_data_arr = []
        for _ in payment_list:
            explanation_data_arr.append({})
        return explanation_data_arr
