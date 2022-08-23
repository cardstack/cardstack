import pandas as pd
from cardpay_reward_programs.rule import Rule
from eth_utils import is_checksum_address


class RetroAirdrop(Rule):
    """
    reward_per_transaction = (total_n_payments in start_block< x <= end_block/ total_n_payments from  start_snapshot_block < x <= end_snapshot_block)
    reward_per_payee (amount) = (total_n_payments of payee in start_block < x <= end_block) * reward_per_transaction

    Test accounts are not included in the reward calculation, but are given a nominal reward of `test_reward`
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(RetroAirdrop, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self,
        total_reward,
        token,
        duration,
        start_snapshot_block,
        end_snapshot_block,
        test_accounts,
        test_reward,
    ):
        self.token = token
        self.duration = duration
        self.total_reward = total_reward
        self.start_snapshot_block = start_snapshot_block
        self.end_snapshot_block = end_snapshot_block
        for account in test_accounts:
            if not is_checksum_address(account):
                raise ValueError(f"{account} is not a valid checksum address")
        self.test_accounts = test_accounts
        self.test_reward = test_reward

    def sql(self, table_query, aux_table_query=None):
        return f"""
        select
            prepaid_card_owner as payee,
            count(*) as transactions
        from {table_query}
        where block_number_uint64 > $1::integer and block_number_uint64 <= $2::integer
        group by prepaid_card_owner
        """

    def get_reward_per_transaction(self):
        total_n_payments = self.count_rows(
            self.start_snapshot_block, self.end_snapshot_block
        )
        reward_per_transaction = self.total_reward / total_n_payments
        if total_n_payments == 0:
            return 0
        else:
            return reward_per_transaction

    def calculate_airdrop_reward_amounts(self, df, payment_cycle, reward_program_id):
        mask = df["payee"].isin(self.test_accounts)
        new_df = df[~mask].copy()
        reward_per_transaction = int(self.total_reward // new_df["transactions"].sum())
        new_df["rewardProgramID"] = reward_program_id
        new_df["paymentCycle"] = payment_cycle
        new_df["validFrom"] = payment_cycle
        new_df["validTo"] = payment_cycle + self.duration
        new_df["token"] = self.token
        new_df["amount"] = new_df["transactions"] * reward_per_transaction
        new_df = new_df.drop(["transactions"], axis=1)
        return new_df

    def get_test_reward_amounts(self, payment_cycle, reward_program_id):
        return pd.DataFrame.from_records(
            {
                "payee": account,
                "rewardProgramID": reward_program_id,
                "paymentCycle": payment_cycle,
                "validFrom": payment_cycle,
                "validTo": payment_cycle + self.duration,
                "token": self.token,
                "amount": self.test_reward,
            }
            for account in self.test_accounts
        )

    def run(self, payment_cycle: int, reward_program_id: str):
        vars = [self.start_snapshot_block, self.end_snapshot_block]
        table_query = self._get_table_query(
            "prepaid_card_payment",
            "prepaid_card_payment",
            self.start_snapshot_block,
            self.end_snapshot_block,
        )
        if table_query == "parquet_scan([])":
            base_df = pd.DataFrame(columns=["payee", "transactions"])
        else:
            base_df = self.run_query(table_query, vars, None)
        airdrop_payments = self.calculate_airdrop_reward_amounts(
            base_df, payment_cycle, reward_program_id
        )
        if len(self.test_accounts) > 0 and self.test_reward > 0:
            test_payments = self.get_test_reward_amounts(
                payment_cycle, reward_program_id
            )
            return pd.concat([airdrop_payments, test_payments])
        else:
            return airdrop_payments
