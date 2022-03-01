from cardpay_reward_programs.rule import Rule


class MinPayments(Rule):
    def __init__(self, **kwargs):
        super(MinPayments, self).__init__(**kwargs)

    def sql(self):
        return
