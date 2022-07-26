import json
import requests
import logging
from eth_utils import to_wei

class Contract:
    def get_gas_price(speed="average"):
        gas_price_oracle = "https://blockscout.com/xdai/mainnet/api/v1/gas-price-oracle"
        current_values = requests.get(gas_price_oracle).json()
        gwei = current_values[speed]
        return to_wei(gwei, "gwei")


class RewardPool(Contract):
    def __init__(self, w3, environment):
        # TODO: extract these into common SDK python code
        if environment == "staging":
            self.address = "0xc9A238Ee71A65554984234DF9721dbdA873F84FA"
        elif environment == "production":
            self.address = "0x340EB99eB9aC7DB3a3eb68dB76c6F62738DB656a"
        self.w3 = w3
        with open(f"abis/RewardPool.json") as contract_file:
            contract_json = json.load(contract_file)
            self.contract = w3.eth.contract(
                address=self.address, abi=contract_json["abi"]
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
