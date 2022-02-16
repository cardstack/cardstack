import json
import logging
from hexbytes import HexBytes
from collections import defaultdict
from eth_utils import to_wei
import requests
from cloudpathlib import AnyPath
from .utils import get_all_reward_outputs, get_root_from_file


class RootSubmitter:
    """
    Class that performs side-effect operations of Tally.
    Operations include:
    - read and aggregate spend events from db
    - use web3 to to write the merkle root
    - use web3 to obtain information from blockchain
    """

    def __init__(
        self,
        w3,
        owner,
        private_key,
        reward_contract_address,
        reward_program_output_root,
        gas_price_oracle="https://blockscout.com/xdai/mainnet/api/v1/gas-price-oracle",
    ):
        self.submitted_payment_cycles = defaultdict(
            set
        )  # reward_program_id -> set(payment_cycles)
        self.w3 = w3
        self.reward_program_output_root = AnyPath(reward_program_output_root)
        self.gas_price_oracle = gas_price_oracle

        with open(f"abis/RewardPool.json") as contract_file:
            contract = json.load(contract_file)
        self.reward_contract = self.w3.eth.contract(
            address=reward_contract_address, abi=contract["abi"]
        )

        self.owner = owner
        self.private_key = private_key

    def get_gas_price(self, speed="average"):
        current_values = requests.get(self.gas_price_oracle).json()
        gwei = current_values[speed]
        return to_wei(gwei, "gwei")

    def submit_root(self, reward_program_id, payment_cycle, root):
        root = HexBytes(root)
        # Safety check it hasn't been submitted already
        if payment_cycle in self.submitted_payment_cycles[reward_program_id]:
            logging.info(
                "Root already submitted for reward program {reward_program_id} payment cycle {payment_cycle}, skipping"
            )
            return
        existing_root = self.reward_contract.caller.payeeRoots(
            reward_program_id, payment_cycle
        )
        # This is like a null check, unsubmitted roots are blank
        if existing_root != HexBytes(
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        ):
            # If it exists, and it's the same as before, it's safe and expected to just skip on
            if existing_root == root:
                logging.info(
                    "Root already submitted for reward program {reward_program_id} payment cycle {payment_cycle}"
                )
                return
        # Now submit the root
        transaction_count = self.w3.eth.get_transaction_count(self.owner)
        tx = self.reward_contract.functions.submitPayeeMerkleRoot(
            reward_program_id, payment_cycle, root
        ).buildTransaction(
            {
                "from": self.owner,
                "nonce": transaction_count,
                "gasPrice": self.get_gas_price(),
            }
        )
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        tx_receipt = self.w3.eth.wait_for_transaction_receipt(
            tx_hash, timeout=240
        )  # there is a timeout to this
        if tx_receipt["status"] == 1:
            # Record that we've done it before
            self.submitted_payment_cycles[reward_program_id].add(payment_cycle)
            logging.info(f"Merkle Root written! See transaction {tx_hash.hex()}")
            return tx_hash
        else:
            raise Exception(
                f"Transaction Receipt with status 0.Transaction receipt: {tx_receipt}"
            )

    def submit_all_roots(self):
        for reward_output in get_all_reward_outputs(self.reward_program_output_root):
            payment_cycle = reward_output["payment_cycle"]
            reward_program_id = reward_output["reward_program_id"]
            if payment_cycle not in self.submitted_payment_cycles[reward_program_id]:
                root = get_root_from_file(reward_output["file"])
                if root is not None:
                    self.submit_root(reward_program_id, payment_cycle, root)
                else:
                    logging.info(
                        "No root found for reward program {reward_program_id} payment cycle {payment_cycle}"
                    )
