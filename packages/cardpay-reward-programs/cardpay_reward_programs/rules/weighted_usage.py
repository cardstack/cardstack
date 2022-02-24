from cardpay_reward_programs.rule import Rule


class WeightedUsage(Rule):
    # maybe specify types here
    required_rule_parameters = ["base_reward", "transaction_factor", "spend_factor"]

    def __init__(self, **kwargs):
        super(WeightedUsage, self).__init__(**kwargs)

    def sql(self):
        return
