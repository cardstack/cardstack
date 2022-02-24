from cardpay_reward_programs.module import Module


class Usage(Module):
    """
    These contain usage rules
    """

    def __init__(self):
        self.name = self.__name__
        super(Usage, self).__init__([])
