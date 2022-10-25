import json
import logging

import requests
from eth_utils import to_wei
from requests.adapters import HTTPAdapter
from urllib3 import Retry


class Contract:
    def __init__(self, w3):
        self.w3 = w3

    def setup_from_environment(self, environment):
        raise Exception("This function must be implemented in the base class")

    def setup_from_address(self, contract_address):
        raise Exception("This function must be implemented in the base class")

    def get_gas_price(self, speed="average"):
        session = requests.Session()
        adapter = HTTPAdapter(max_retries=Retry(total=4, backoff_factor=1))
        session.mount("https://", adapter)
        gas_price_oracle = "https://blockscout.com/xdai/mainnet/api/v1/gas-price-oracle"
        current_values = session.get(gas_price_oracle).json()
        gwei = current_values[speed]
        return to_wei(gwei, "gwei")


class RewardPool(Contract):
    def __init__(self, w3):
        self.w3 = w3

    def setup_from_environment(self, environment):
        if environment == "staging":
            self.setup_from_address("0xcF8852D1aD746077aa4C31B423FdaE5494dbb57A")
        elif environment == "production":
            self.setup_from_address("0x340EB99eB9aC7DB3a3eb68dB76c6F62738DB656a")
        else:
            raise Exception(f"Environment '{environment}' not recognised")

    def setup_from_address(self, contract_address):
        with open("abis/reward-pool.json") as contract_file:
            contract_json = json.load(contract_file)
            self.contract = self.w3.eth.contract(
                address=contract_address, abi=contract_json
            )

    def submit_merkle_root(
        self, reward_program_id, payment_cycle, root, caller, caller_key
    ):
        transaction_count = self.w3.eth.get_transaction_count(caller)
        tx = self.contract.functions.submitPayeeMerkleRoot(
            reward_program_id, payment_cycle, root
        ).buildTransaction(
            {
                "from": caller,
                "nonce": transaction_count,
                "gasPrice": self.get_gas_price(),
            }
        )
        signed_tx = self.w3.eth.account.sign_transaction(tx, caller_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        tx_receipt = self.w3.eth.wait_for_transaction_receipt(
            tx_hash, timeout=240
        )  # there is a timeout to this
        if tx_receipt["status"] == 1:
            logging.info(f"Merkle Root written! See transaction {tx_hash.hex()}")
            return tx_hash
        else:
            raise Exception(
                f"Transaction Receipt with status 0.Transaction receipt: {tx_receipt}"
            )
