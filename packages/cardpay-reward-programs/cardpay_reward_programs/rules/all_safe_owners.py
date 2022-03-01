from cardpay_reward_programs.rule import Rule


class AllSafeOwners(Rule):
    def __init__(self, **kwargs):
        super(AllSafeOwners, self).__init__(**kwargs)

    def sql(self):
        return

    def set_user_defined_parameters(self):
        return
