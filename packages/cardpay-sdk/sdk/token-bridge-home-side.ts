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

/**
 * The TokenBridge is created between 2 networks, referred to as a Native (or Home) Network and a Foreign network.
 * The Native or Home network has fast and inexpensive operations. All bridge operations to collect validator confirmations are performed on this side of the bridge.
 * The Foreign network can be any chain, but generally refers to the Ethereum mainnet.
 * @group Cardpay
 */

/**
 * @group Cardpay
 */
export interface ITokenBridgeHomeSide {
  waitForBridgingToLayer2Completed(recipientAddress: string, fromBlock: string): Promise<SuccessfulTransactionReceipt>;
}

/**
 * @group Cardpay
 */
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

/**
 * The `TokenBridgeHomeSide` API is used to bridge tokens into the layer 2 network in which the Card Protocol runs. The `TokenBridgeHomeSide` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 2 network (like Gnosis Chain or Sokol). * @example
 * @group Cardpay
 * @example
 * ```ts
 * import { getSDK } from "@cardstack/cardpay-sdk";
 * let web3 = new Web3(myProvider); // Layer 2 web3 instance
 * let tokenBridge = await getSDK('TokenBridgeHomeSide', web3);
 * ```
 */
export default class TokenBridgeHomeSide implements ITokenBridgeHomeSide {
  constructor(private layer2Web3: Web3, private layer2Signer?: Signer) {}

  /**
   * @returns the minimum and maximum withdrawal limits as a string in token units (we assume 18 decimals, i.e. `wei`) for bridging a token to layer 1. This method is invoked with the layer 2 CPXD token address of the CPXD token being withdrawn.
   * @example
   * ```js
   * let { min, max } = await tokenBridge.getWithdrawalLimits(daiTokenAddress);
   * ```
   */
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

  /**
   * This call will invoke the token bridge contract to relay tokens from a layer 2 safe into the account specified in layer 1.
   *
   *@param safeAddress The layer 2 safe address that contains the tokens to be relayed to layer 1
   *@param tokenAddress The layer 2 token address of the tokens to be relayed
   *@param recipientAddress The address of the layer 1 recipient that will receive the tokens in layer 1
   *@param amount The amount of tokens to relay as a string in native units of the token (e.g. `wei`). Note that in addition to the amount of tokens being relayed, the safe will also be changed the layer 2 gas costs for performing the relay as well (the gas cost will be charged in the same tokens as is being relayed). So the safe must have a balance that includes both the amount being relayed as well as the layer 2 gas charged in order to perform the relay.
   * @param txnOptions You can optionally provide an object that specifies the nonce, onNonce callback, and/or onTxnHash callback as a fourth argument.
   * @param contractOptions You can optionally provide an object that specifies the from address, gas limit, and/or gas price as a fifth argument.
   * @example
   * ```ts
   * let result = await tokenBridge.relayTokens(
   *   layer2SafeAddress,
   *   tokenAddress,
   *   layer1RecipientAddress,
   *   amountInWei
   * );
   * ```
   */
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
      await signSafeTx(
        this.layer2Web3,
        safeAddress,
        tokenAddress,
        payload,
        Operation.CALL,
        estimate,
        nonce,
        from,
        this.layer2Signer
      )
    );

    let txnHash = result.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, safeAddress, nonce);
  }

  /**
   *
   * This call waits for the token bridge validators to perform their necessary signatures on the token bridge request from layer 2 to layer 1. After the bridge validators have signed the bridging request, this call will return a `messageId`, `encodedData`, and `signatures` for the bridging request. These items can then be used to claim the bridged tokens in layer 1.
   *
   * This method is invoked with:
   * - The block height of layer 2 before the relayTokens call was initiated on the home side of the bridge. Get it with `await layer2Web3.eth.getBlockNumber()`
   * - The layer 2 transaction hash for the bridging transaction (the result of `TokenBridgeHomeSide.relayTokens`).
   * @example
   * ```ts
   * let {
   *   messageId,
   *   encodedData,
   *   signatures
   * } = await tokenBridge.waitForBridgingValidation(fromBlock, txnHash);
   * ```
   */
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

  /**
   *
   * This call will listen for a `TokensBridgedToSafe` event emitted by the TokenBridge home contract that has a recipient matching the specified address. The starting layer 2 block height should be captured before the call to relayTokens is made to begin bridging. It is used to focus the search and avoid matching on a previous bridging for this user.
   *
   * @param recipientAddress The address of the layer 2 account that will own the resulting safe (passed as receiver to relayTokens call)
   * @param fromBlock The block height of layer 2 before the relayTokens call was initiated on the foreign side of the bridge. Get it with `await layer2Web3.eth.getBlockNumber()`
   * @returns promise that includes a web3 transaction receipt for the layer 2 transaction, from which you can obtain the transaction hash, ethereum events, and other details about the transaction https://web3js.readthedocs.io/en/v1.3.4/web3-eth-contract.html#id37.
   * @remarks We use the subgraph to act as our indicator that bridging has completed, as this is the same mechanism that is populating the card wallet's displayed token balances
   * @example
   * ```ts
   *
   * let txnReceipt = await tokenBridge.waitForBridgingToLayer2Completed(
   * recipientAddress
   * startingBlockHeight,
   * );
   * ```
   */
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
