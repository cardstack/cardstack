import hashlib
import json
from abc import ABC, abstractmethod
from email.policy import default
from gc import unfreeze
from pathlib import Path

import pandas as pd
from cardpay_reward_programs.config import default_config, required_core_parameters
from cardpay_reward_programs.rules import *  # have to import this to have accessible in namespace


class Module(ABC):
    def __init__(self, config_path):
        self.config = self.parse_config(
            self.get_module_config(config_path)
        )  # this is a full module config
        self.rules = self.get_rules()

    def name(self):
        return self.__class__.__name__

    @property
    def rule_names(self):
        return list(map(lambda r: r.name(), self.rules))

    @staticmethod
    def get_module_config(config_path):
        path = Path(config_path)
        with path.open() as f:
            data = json.load(f)
            return data

    # ==== some parsing ====
    def parse_config(self, config):
        """
        this function should be idempotent
        this function ensures that our data although missing will describe module
        """
        core = self.parse_core_config(config["core"].copy())
        rules = self.parse_rule_config(config["rules"].copy())
        return {"core": core, "rules": rules}

    def parse_core_config(self, core_config):
        required_keys = ["name", "docker_image", "parameters"]
        check_required_keys(core_config, required_keys)
        core_config["parameters"] = self.parse_core_parameters(core_config["parameters"].copy())
        return core_config

    def parse_rule_config(self, rule_config):
        for rule in rule_config:
            required_keys = ["name", "parameters", "rule_parameters"]
            check_required_keys(rule, required_keys)
            if rule["name"] not in globals().keys():
                raise Exception("rule config has unrecognized name")
            rule["parameters"] = self.parse_core_parameters(rule["parameters"].copy())
            rule["rule_parameters"] = self.parse_rule_parameters(
                rule["name"], rule["rule_parameters"].copy()
            )
        return rule_config

    def parse_core_parameters(self, core_parameters):
        check_required_keys(core_parameters, required_core_parameters)
        return core_parameters

    def parse_rule_parameters(self, name, rule_parameters):
        check_required_keys(rule_parameters, rule_constructor(name).required_rule_parameters)
        return rule_parameters

    def get_rules(self):
        unformatted_rules = self.config["rules"].copy()
        if len(unformatted_rules) == 0:
            raise Exception("A module must have at least one rule")
        rules = []
        for o in unformatted_rules:
            # module
            parameters = o["parameters"]
            # rule
            name = o["name"]
            rule_parameters = o["rule_parameters"]
            rule = self.create_rule(name, parameters, rule_parameters)
            rules.append(rule)
        return rules

    def create_rule(self, name, parameters, rule_parameters):
        o = parameters.copy()
        o.update(rule_parameters)
        return rule_constructor(name)(**o)

    def run(self, payment_cycle):
        payments = []
        for rule in self.rules:
            payments.append(rule.run(payment_cycle))
        return payments

    # hashing code should be here
    def hash(self):
        """after updating the rule, the hash should change"""
        o = json.dumps(self.config, sort_keys=True)
        return hashlib.md5(o.encode("utf-8")).hexdigest()

    def hash_with_docker_info(self):
        return


def rule_constructor(name):
    """
    name has to be the class name,
    assumes the class is available in global namespace of file
    """
    if name not in globals().keys():
        raise Exception("config has unrecognized name")
    return globals()[name]


def check_required_keys(o, required_keys=[]):
    for required_key in required_keys:
        if required_key not in o.keys():
            raise Exception("f{required_key} does not exist in config")
    return o
