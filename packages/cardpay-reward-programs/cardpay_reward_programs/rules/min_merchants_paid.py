from cardpay_reward_programs.rule import Rule


class MinMerchantsPaid(Rule):
    required_rule_parameters = ["minimum_n_merchants"]

    def __init__(self, **kwargs):
        super(MinMerchantsPaid, self).__init__(**kwargs)

    def sql(self):
        return
