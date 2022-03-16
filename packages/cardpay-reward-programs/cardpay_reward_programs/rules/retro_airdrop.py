import pandas as pd
from cardpay_reward_programs.config import default_payment_list
from cardpay_reward_programs.rule import Rule


class RetroAirdrop(Rule):
    """
    reward_per_transaction = (total_n_payments in start_block< x <= end_block/ total_n_payments from  start_snapshot_block < x <= end_snapshot_block)
    reward_per_payee (amount) = (total_n_payments of payee in start_block < x <= end_block) * reward_per_transaction
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(RetroAirdrop, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self,
        total_reward,
        token,
        subgraph_config_location,
        duration,
        start_snapshot_block,
        end_snapshot_block,
        excluded_accounts
    ):
        self.token = token
        self.subgraph_config_location = subgraph_config_location
        self.duration = duration
        self.total_reward = total_reward
        self.start_snapshot_block = start_snapshot_block
        self.end_snapshot_block = end_snapshot_block
        self.excluded_accounts = set(account.lower() for account in excluded_accounts)

    def sql(self, table_query):
        return f"""
        select 
            prepaid_card_owner as payee,
            count(*) as transactions
        from {table_query}
        where block_number_uint64 > $1::integer and block_number_uint64 <= $2::integer
        group by prepaid_card_owner
        """

    def get_reward_per_transaction(self):
        total_n_payments = self.count_rows(self.start_snapshot_block, self.end_snapshot_block)
        reward_per_transaction = self.total_reward / total_n_payments
        if total_n_payments == 0:
            return 0
        else:
            return reward_per_transaction

    def df_to_payment_list(
        self, df, payment_cycle, reward_program_id
    ):
        mask = df['payee'].str.lower().isin(self.excluded_accounts)
        new_df = df[~mask].copy()
        reward_per_transaction = self.total_reward / new_df["transactions"].sum()
        new_df["rewardProgramID"] = reward_program_id
        new_df["paymentCycle"] = payment_cycle
        new_df["validFrom"] = self.end_block
        new_df["validTo"] = self.end_block + self.duration
        new_df["token"] = self.token
        new_df["amount"] = new_df["transactions"] * reward_per_transaction
        new_df = new_df.drop(["transactions"], axis=1)
        return new_df

    def run(self, payment_cycle: int, reward_program_id: str):
        vars = [self.start_snapshot_block, self.end_snapshot_block]
        table_query = self._get_table_query("prepaid_card_payment", "prepaid_card_payment", self.start_snapshot_block, self.end_snapshot_block)
        if table_query == "parquet_scan([])":
            base_df = pd.DataFrame(columns=["payee", "transactions"])
        else:
            base_df = self.run_query(table_query, vars)
        return self.df_to_payment_list(base_df, payment_cycle, reward_program_id)