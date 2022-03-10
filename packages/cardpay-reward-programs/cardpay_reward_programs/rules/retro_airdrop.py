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
    ):
        self.token = token
        self.subgraph_config_location = subgraph_config_location
        self.duration = duration
        self.total_reward = total_reward
        self.start_snapshot_block = start_snapshot_block
        self.end_snapshot_block = end_snapshot_block

    def sql(self, table_query):
        return f"""
        select 
            prepaid_card_owner as payee,
            count(*) as transactions
        from {table_query}
        where block_number_uint64 > ?::integer and block_number_uint64 <= ?::integer 
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
        self, df, payment_cycle=1, reward_program_id="0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E"
    ):
        reward_per_transaction = self.get_reward_per_transaction()
        if reward_per_transaction == 0:
            return default_payment_list
        if df.empty:
            return default_payment_list.copy()
        new_df = df.copy()
        new_df["rewardProgramID"] = reward_program_id
        new_df["paymentCycle"] = payment_cycle
        new_df["validFrom"] = self.end_block
        new_df["validTo"] = self.end_block + self.duration
        new_df["token"] = self.token
        new_df["amount"] = new_df["transactions"] * reward_per_transaction
        new_df = new_df.drop(["transactions"], axis=1)
        return new_df

    def count_rows(self, start_block, end_block):
        table_query = self._get_table_query("prepaid_card_payment", start_block, end_block)
        sql = f"""
        select 
        count(*) as count
        from {table_query}
        where block_number_uint64 > ?::integer and block_number_uint64 <= ?::integer 
        """
        if table_query == "parquet_scan([])":
            return 0
        else:
            return self.run_query(table_query, [start_block, end_block], sql)["count"][0]

    def run(self, start_block: int, end_block: int):
        vars = [start_block, end_block]
        table_query = self._get_table_query("prepaid_card_payment", start_block, end_block)
        if table_query == "parquet_scan([])":
            return pd.DataFrame(columns=["payee", "transactions"])
        else:
            return self.run_query(table_query, vars)

    def aggregate(self, cached_df=[]):
        if len(cached_df) == 0:
            return pd.DataFrame(columns=["payee", "transactions"])
        else:
            return pd.concat(cached_df).groupby("payee").sum().reset_index()
