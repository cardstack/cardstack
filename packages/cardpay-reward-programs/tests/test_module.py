import json
from pathlib import Path

import pytest
from cardpay_reward_programs.config import default_config
from cardpay_reward_programs.programs import Default
from cardpay_reward_programs.rules import AllSafeOwners


def get_module_config():
    path = (Path(__file__).parent / "data/rules/default.json").resolve()
    with path.open() as f:
        data = json.load(f)
        return data


def compare(dict, o, ignored_keys=[]):
    for key in dict.keys():
        if key not in ignored_keys:
            assert dict[key] == getattr(o, key)


class TestRuleParams:
    """
    Testng Rule Params
    """

    def test_rule_default_parameters(self):
        rule = AllSafeOwners()  # put custom parameters here
        compare(default_config, rule)

    def test_rule_override_parameters(self):
        custom_reward_token = "0xc9A238Ee71A65554984234DF9721dbdA873F84FA"
        rule = AllSafeOwners(token=custom_reward_token)
        compare(default_config, rule, ["token"])
        assert rule.token == custom_reward_token


class TestModuleParams:
    def test_load_config(self):
        path = (Path(__file__).parent / "data/configs/default.json").resolve()
        program = Default(path)
        print(program.rule_names)

    def test_name_exists_in_config(self):
        with pytest.raises(Exception):
            path = (Path(__file__).parent / "data/configs/default.json").resolve()
            Default(path)

    def test_at_least_one_rule(self):
        with pytest.raises(Exception):
            Default([])

    def test_config_different_have_same_hash(self):
        path = (Path(__file__).parent / "data/configs/default.json").resolve()
        hash_1 = Default(path).hash()
        path = (Path(__file__).parent / "data/configs/default_full.json").resolve()
        hash_2 = Default(path).hash()
        assert hash_1 == hash_2
