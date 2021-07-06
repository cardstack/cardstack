import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { ContractOptions, EventData } from 'web3-eth-contract';
import HomeBridgeABI from '../contracts/abi/home-bridge-mediator';
import ERC677ABI from '../contracts/abi/erc-677';
import { getAddress } from '../contracts/addresses';
import { waitForEvent, waitUntilTransactionMined } from './utils/general-utils';
import { executeTransaction, gasEstimate, GnosisExecTx } from './utils/safe-utils';
import { AbiItem, fromWei, toBN } from 'web3-utils';
import { signSafeTxAsRSV } from './utils/signing-utils';
import { ZERO_ADDRESS } from './constants';

// The TokenBridge is created between 2 networks, referred to as a Native (or Home) Network and a Foreign network.
// The Native or Home network has fast and inexpensive operations. All bridge operations to collect validator confirmations are performed on this side of the bridge.
// The Foreign network can be any chain, but generally refers to the Ethereum mainnet.

export interface ITokenBridgeHomeSide {
  waitForBridgingCompleted(recipientAddress: string, fromBlock: string): Promise<TransactionReceipt>;
}

export default class TokenBridgeHomeSide implements ITokenBridgeHomeSide {
  constructor(private layer2Web3: Web3) {}

  async relayTokens(
    safeAddress: string,
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
    options?: ContractOptions
  ): Promise<GnosisExecTx> {
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
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
    let estimate = await gasEstimate(this.layer2Web3, safeAddress, tokenAddress, '0', payload, 0, tokenAddress);
    let gasCost = toBN(estimate.dataGas).add(toBN(estimate.baseGas)).mul(toBN(estimate.gasPrice));
    if (safeBalance.lt(toBN(amount).add(gasCost))) {
      throw new Error(
        `Safe does not have enough balance to pay for gas when relaying tokens. The token ${tokenAddress} balance of safe ${safeAddress} is ${fromWei(
          safeBalance.toString()
        )} ${symbol}, amount to transfer ${fromWei(amount)} ${symbol}, the gas cost is ${fromWei(gasCost)} ${symbol}`
      );
    }

    if (estimate.lastUsedNonce == null) {
      estimate.lastUsedNonce = -1;
    }
    let signatures = await signSafeTxAsRSV(
      this.layer2Web3,
      tokenAddress,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      estimate.gasToken,
      ZERO_ADDRESS,
      toBN(estimate.lastUsedNonce + 1),
      from,
      safeAddress
    );
    let result = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      tokenAddress,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      toBN(estimate.lastUsedNonce + 1).toString(),
      signatures,
      estimate.gasToken,
      ZERO_ADDRESS
    );
    return result;
  }

  async waitForBridgingCompleted(recipientAddress: string, fromBlock: string): Promise<TransactionReceipt> {
    let homeBridge = new this.layer2Web3.eth.Contract(
      HomeBridgeABI as any,
      await getAddress('homeBridge', this.layer2Web3)
    );
    let opts = {
      filter: {
        recipient: recipientAddress,
      },
      fromBlock: fromBlock,
      toBlock: 'latest',
    };
    let events = await homeBridge.getPastEvents('TokensBridgedToSafe', opts);
    let event!: EventData;
    if (events.length) {
      event = events[events.length - 1];
    } else {
      // // @ts-ignore
      // let usePolling = !this.layer2Web3.currentProvider?.on;
      let usePolling = true; // always use polling until we figure out how to get subscriptions to work properly
      event = await new Promise((resolve, reject) => {
        if (usePolling) {
          resolve(waitForEvent(homeBridge, 'TokensBridgedToSafe', opts));
        } else {
          homeBridge.once('TokensBridgedToSafe', opts, function (error: Error, event: EventData) {
            if (error) {
              reject(error);
            } else {
              resolve(event);
            }
          });
        }
      });
    }
    let transactionReceipt = await waitUntilTransactionMined(this.layer2Web3, event.transactionHash);
    return transactionReceipt;
  }
}
