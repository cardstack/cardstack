import pandas as pd
from cardpay_reward_programs.config import default_payment_list
from cardpay_reward_programs.rule import Rule


class FlatPayment(Rule):
    """
    This rule pays a fixed amount to all specified users.
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(FlatPayment, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self,
        reward_per_user,
        token,
        duration,
        accounts
    ):
        self.token = token
        self.duration = duration
        self.reward_per_user = reward_per_user
        self.accounts = accounts
    
    def sql(self):
        return None

    def run(self, payment_cycle: int, reward_program_id: str):
        if len(self.accounts) == 0:
            return default_payment_list
        return pd.DataFrame.from_records(
            {
                "payee": account,
                "rewardProgramID": reward_program_id,
                "paymentCycle": payment_cycle,
                "validFrom": payment_cycle,
                "validTo": payment_cycle + self.duration,
                "token": self.token,
                "amount": self.reward_per_user,
            } for account in self.accounts)