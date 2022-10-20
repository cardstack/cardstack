import pandas as pd
from cardpay_reward_programs.config import default_payment_list
from cardpay_reward_programs.rule import Rule


class FlatPayment(Rule):
    """
    This rule pays a fixed amount to all specified users.
    """

    def __init__(
        self,
        core_parameters,
        user_defined_parameters,
        explanation_block={},
        metadata={},
    ):
        super(FlatPayment, self).__init__(
            core_parameters, user_defined_parameters, explanation_block, metadata
        )

    def set_user_defined_parameters(self, reward_per_user, token, accounts):
        self.token = token
        self.reward_per_user = reward_per_user
        self.accounts = accounts

    def sql(self):
        return None

    def run(self, payment_cycle: int, reward_program_id: str):
        if len(self.accounts) == 0:
            return default_payment_list
        o = pd.DataFrame.from_records(
            {
                "payee": account,
                "rewardProgramID": reward_program_id,
                "paymentCycle": payment_cycle,
                "validFrom": payment_cycle,
                "validTo": payment_cycle + self.duration,
                "token": self.token,
                "amount": self.reward_per_user,
            }
            for account in self.accounts
        )
        return o

    def get_explanation_data_arr(self, payment_list):
        explanation_data_arr = []
        for payment in payment_list:
            explanation_data_arr.append(
                {"amount": payment["amount"], "token": payment["token"]}
            )
        return explanation_data_arr
