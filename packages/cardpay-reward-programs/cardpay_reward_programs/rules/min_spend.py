from cardpay_reward_programs.rule import Rule


class MinSpend(Rule):
    def __init__(self, **kwargs):
        super(MinSpend, self).__init__(**kwargs)

    def sql(self):
        return
