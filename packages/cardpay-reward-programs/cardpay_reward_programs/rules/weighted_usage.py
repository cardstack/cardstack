import pandas as pd
from cardpay_reward_programs.config import default_payment_list
from cardpay_reward_programs.rule import Rule


class WeightedUsage(Rule):
    def __init__(self, core_parameters, user_defined_parameters):
        super(WeightedUsage, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self,
        base_reward: int,
        transaction_factor: int,
        spend_factor: int,
        token: str,
        duration: int,
        subgraph_config_location,
    ):
        self.base_reward = base_reward
        self.transaction_factor = transaction_factor
        self.spend_factor = spend_factor
        self.token = token
        self.subgraph_config_location = subgraph_config_location
        self.duration = duration

    def sql(self, table_query):
        return f"""
        select
        prepaid_card_owner as payee,

        ($1 *
        1 + (1-(percent_rank() over (order by sum(spend_amount_uint64)  desc))) * ($2)
        *
        1 + (1-(percent_rank() over (order by count(*)  desc))) * ($3))::integer as amount,

        count(*) as transactions,
        sum(spend_amount_uint64) as total_spent

        from {table_query}
        where block_number_uint64 > $4::integer and block_number_uint64 <= $5::integer 
        group by prepaid_card_owner
        order by transactions desc
        """

    def df_to_payment_list(
        self, df, payment_cycle=1, reward_program_id="0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E"
    ):
        if df.empty:
            return default_payment_list
        new_df = df.copy()
        new_df = new_df[["payee", "amount"]].groupby("payee").sum().reset_index()
        new_df["rewardProgramID"] = reward_program_id
        new_df["paymentCycle"] = payment_cycle
        new_df["validFrom"] = payment_cycle
        new_df["validTo"] = payment_cycle + self.duration
        new_df["token"] = self.token
        new_df["paymentCycle"] = self.end_block
        return new_df[new_df["amount"] > 0]

    def run(self, payment_cycle: int, reward_program_id: str):
        start_block, end_block = payment_cycle - self.payment_cycle_length, payment_cycle
        vars = [
            self.base_reward,
            self.spend_factor,
            self.transaction_factor,
            start_block,
            end_block,
        ]
        table_query = self._get_table_query("prepaid_card_payment", "prepaid_card_payment", start_block, end_block)
        if table_query == "parquet_scan([])":
            base_df = pd.DataFrame(columns=["payee", "amount", "transactions", "total_spent"])
        else:
            base_df = self.run_query(table_query, vars)
        return self.df_to_payment_list(base_df, payment_cycle, reward_program_id)

    def aggregate(self, cached_df=[]):
        return pd.concat(cached_df)
