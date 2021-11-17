/*global fetch */

import Web3 from 'web3';
import config from 'config';
import Logger from '@cardstack/logger';
import { getConstantByNetwork, HttpProvider } from '@cardstack/cardpay-sdk';
import { provider as Provider } from 'web3-core';

interface Web3Config {
  network: string;
}

const { network } = config.get('web3') as Web3Config;
let log = Logger('service:web3');

export default class Web3Service {
  private web3: Web3 | undefined;

  getInstance() {
    if (!this.web3) {
      let rpcURL = getConstantByNetwork('rpcNode', network);
      // We use the special HttpProvider from the SDK which has fixes to deal
      // with parity annoyances
      this.web3 = new Web3(new HttpProvider(rpcURL) as Provider);
    }
    return this.web3;
  }

  async isAvailable(): Promise<boolean> {
    let rpcURL = getConstantByNetwork('rpcNode', network);
    try {
      let response = await fetch(rpcURL);
      if (!response.ok) {
        log.error(`RPC node, ${rpcURL}, is not available: ${response.status}`);
      }
      return response.ok;
    } catch (e) {
      log.error(`Error encountered while checking if rpc node ${rpcURL} is available`, e);
      return false;
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    web3: Web3Service;
  }
}
