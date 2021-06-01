import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { EventData } from 'web3-eth-contract';
import HomeBridgeABI from '../contracts/abi/home-bridge-mediator';
import { getAddress } from '../contracts/addresses';
import { waitForEvent, waitUntilTransactionMined } from './utils/general-utils';

// The TokenBridge is created between 2 networks, referred to as a Native (or Home) Network and a Foreign network.
// The Native or Home network has fast and inexpensive operations. All bridge operations to collect validator confirmations are performed on this side of the bridge.
// The Foreign network can be any chain, but generally refers to the Ethereum mainnet.

export default class TokenBridgeHomeSide {
  constructor(private layer2Web3: Web3) {}

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
