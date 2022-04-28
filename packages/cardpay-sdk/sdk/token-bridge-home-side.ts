import Web3 from 'web3';
import type { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';
import { ContractOptions, EventData } from 'web3-eth-contract';
import ERC677ABI from '../contracts/abi/erc-677';
import HomeAMBABI from '../contracts/abi/home-amb';
import HomeBridgeMediatorABI from '../contracts/abi/home-bridge-mediator';
import BridgeValidatorsABI from '../contracts/abi/bridge-validators';
import { getAddress } from '../contracts/addresses';
import { executeTransaction, gasEstimate, getNextNonceFromEstimate, Operation } from './utils/safe-utils';
import { AbiItem, fromWei, toBN } from 'web3-utils';
import { signSafeTx } from './utils/signing-utils';
import { query } from './utils/graphql';
import {
  TransactionOptions,
  waitForTransactionConsistency,
  isTransactionHash,
  waitUntilTransactionMined,
} from './utils/general-utils';
import { Signer } from 'ethers';

// The TokenBridge is created between 2 networks, referred to as a Native (or Home) Network and a Foreign network.
// The Native or Home network has fast and inexpensive operations. All bridge operations to collect validator confirmations are performed on this side of the bridge.
// The Foreign network can be any chain, but generally refers to the Ethereum mainnet.

export interface ITokenBridgeHomeSide {
  waitForBridgingToLayer2Completed(recipientAddress: string, fromBlock: string): Promise<SuccessfulTransactionReceipt>;
}

export interface BridgeValidationResult {
  messageId: string;
  encodedData: string;
  signatures: string[];
}

const POLL_INTERVAL = 1000;
const TIMEOUT = 1000 * 60 * 5;
const bridgedTokensQuery = `
  query ($account: ID!, $fromBlock: BigInt!) {
    account(id: $account) {
      depots {
        id
        receivedBridgedTokens(where: {blockNumber_gte: $fromBlock}) {
          blockNumber
          transaction {
            id
          }
        }
      }
    }
  }
`;

export default class TokenBridgeHomeSide implements ITokenBridgeHomeSide {
  constructor(private layer2Web3: Web3, private layer2Signer?: Signer) {}

  async getWithdrawalLimits(tokenAddress: string): Promise<{ min: string; max: string }> {
    let homeBridge = new this.layer2Web3.eth.Contract(
      HomeBridgeMediatorABI as AbiItem[],
      await getAddress('homeBridge', this.layer2Web3)
    );
    let [min, max] = await Promise.all([
      homeBridge.methods.minPerTx(tokenAddress).call(),
      homeBridge.methods.maxPerTx(tokenAddress).call(),
    ]);
    return { min: min.toString(), max: max.toString() };
  }

  async relayTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async relayTokens(
    safeAddress: string,
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async relayTokens(
    safeAddressOrTxnHash: string,
    tokenAddress?: string,
    recipientAddress?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    let safeAddress = safeAddressOrTxnHash;
    if (!tokenAddress) {
      throw new Error('tokenAddress must be provided');
    }
    if (!amount) {
      throw new Error('amount must be provided');
    }
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let homeBridgeAddress = await getAddress('homeBridge', this.layer2Web3);
    let token = new this.layer2Web3.eth.Contract(ERC677ABI as AbiItem[], tokenAddress);
    let symbol = await token.methods.symbol().call();
    let safeBalance = toBN(await token.methods.balanceOf(safeAddress).call());
    if (safeBalance.lt(toBN(amount))) {
      throw new Error(
        `Safe does not have enough balance to transfer tokens. The token ${tokenAddress} balance of safe ${safeAddress} is ${fromWei(
          safeBalance.toString()
        )} ${symbol}, amount to transfer ${fromWei(amount)} ${symbol}`
      );
    }

    let payload = token.methods.transferAndCall(homeBridgeAddress, amount, recipientAddress).encodeABI();
    let estimate = await gasEstimate(
      this.layer2Web3,
      safeAddress,
      tokenAddress,
      '0',
      payload,
      Operation.CALL,
      tokenAddress
    );
    let gasCost = toBN(estimate.safeTxGas).add(toBN(estimate.baseGas)).mul(toBN(estimate.gasPrice));
    if (safeBalance.lt(toBN(amount).add(gasCost))) {
      throw new Error(
        `Safe does not have enough balance to pay for gas when relaying tokens. The token ${tokenAddress} balance of safe ${safeAddress} is ${fromWei(
          safeBalance.toString()
        )} ${symbol}, amount to transfer ${fromWei(amount)} ${symbol}, the gas cost is ${fromWei(gasCost)} ${symbol}`
      );
    }
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }
    let result = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      tokenAddress,
      payload,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(this.layer2Web3, safeAddress, tokenAddress, payload, estimate, nonce, from, this.layer2Signer)
    );

    let txnHash = result.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, safeAddress, nonce);
  }

  async waitForBridgingValidation(fromBlock: string, bridgingTxnHash: string): Promise<BridgeValidationResult> {
    let signatureEvents: EventData[] | undefined;
    let homeAmb = new this.layer2Web3.eth.Contract(
      HomeAMBABI as AbiItem[],
      await getAddress('homeAMB', this.layer2Web3)
    );
    {
      let start = Date.now();
      do {
        if (signatureEvents) {
          await new Promise<void>((res) => setTimeout(() => res(), POLL_INTERVAL));
        }
        signatureEvents = await homeAmb.getPastEvents('UserRequestForSignature', {
          fromBlock,
        });
        signatureEvents = signatureEvents.filter((e) => e.transactionHash === bridgingTxnHash);
      } while (signatureEvents.length === 0 && Date.now() < start + TIMEOUT);
    }

    if (signatureEvents.length === 0) {
      throw new Error(
        `Timed out waiting for bridge validation for bridging to layer 1 for txn hash ${bridgingTxnHash}`
      );
    }
    if (signatureEvents.length > 1) {
      throw new Error(
        `Do not know how to handle multiple UserRequestForSignature events in the same txn for txn hash ${bridgingTxnHash}`
      );
    }

    let { messageId, encodedData } = signatureEvents[0].returnValues;
    let messageHash = this.layer2Web3.utils.soliditySha3Raw(encodedData);
    let signatureCount: number | undefined;
    let validatorContractAddress = await homeAmb.methods.validatorContract().call();
    let validator = new this.layer2Web3.eth.Contract(BridgeValidatorsABI as AbiItem[], validatorContractAddress);
    let requiredSignatures = toBN(await validator.methods.requiredSignatures().call()).toNumber();
    {
      let start = Date.now();
      do {
        let validators = await validator.methods.validatorList().call();
        if (signatureCount != null) {
          await new Promise<void>((res) => setTimeout(() => res(), POLL_INTERVAL));
        }
        signatureCount = 0;
        for (let validator of validators) {
          const hashSenderMsg = this.layer2Web3.utils.soliditySha3Raw(validator, messageHash);
          if (await homeAmb.methods.messagesSigned(hashSenderMsg).call()) {
            signatureCount++;
          }
        }
      } while (signatureCount < requiredSignatures && Date.now() < start + TIMEOUT);
    }

    if (signatureCount < requiredSignatures) {
      throw new Error(
        `Timed out waiting for ${requiredSignatures} bridge validators to sign bridging request for ${bridgingTxnHash}, only received ${signatureCount} validation signatures`
      );
    }
    const signatures = await Promise.all(
      Array.from(Array(requiredSignatures).keys()).map((i) => homeAmb.methods.signature(messageHash, i).call())
    );

    return { messageId, encodedData, signatures };
  }

  // We use the subgraph to act as our indicator that bridging has completed, as
  // this is the same mechanism that is populating the card wallet's
  // displayed token balances
  async waitForBridgingToLayer2Completed(
    recipientAddress: string,
    fromBlock: string
  ): Promise<SuccessfulTransactionReceipt> {
    let start = Date.now();
    let queryResults: GraphQLBridgeResult | undefined;
    let receivedBridgedTokens: GraphQLBridgeResult['data']['account']['depots'][0]['receivedBridgedTokens'];
    do {
      if (queryResults) {
        await new Promise<void>((res) => setTimeout(() => res(), POLL_INTERVAL));
      }
      queryResults = await query(this.layer2Web3, bridgedTokensQuery, { account: recipientAddress, fromBlock });
      receivedBridgedTokens = queryResults.data.account?.depots[0]?.receivedBridgedTokens ?? [];
    } while (receivedBridgedTokens.length === 0 && Date.now() < start + TIMEOUT);

    if (receivedBridgedTokens.length === 0) {
      throw new Error(
        `Timed out waiting for tokens to be bridged to layer 2 for safe owned by ${recipientAddress} after block ${fromBlock}`
      );
    }

    let {
      transaction: { id: txnHash },
    } = receivedBridgedTokens[0];
    return await waitUntilTransactionMined(this.layer2Web3, txnHash);
  }
}

interface GraphQLBridgeResult {
  data: {
    account: {
      depots: {
        id: string;
        receivedBridgedTokens: {
          blockNumber: string;
          transaction: {
            id: string;
          };
        }[];
      }[];
    };
  };
}
