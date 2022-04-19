/*global fetch */

import Web3 from 'web3';
import config from 'config';
import Logger from '@cardstack/logger';
let log = Logger('service:web3-http');

export default class Web3HttpService {
  private web3: Web3 | undefined;

  getInstance() {
    if (!this.web3) {
      let rpcURL = config.get('web3.layer2RpcNodeHttpsUrl') as string;
      this.web3 = new Web3(rpcURL);
    }
    return this.web3;
  }

  async isAvailable(): Promise<boolean> {
    let rpcURL = config.get('web3.layer2RpcNodeHttpsUrl') as string;
    try {
      let response = await fetch(rpcURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 100,
          method: 'eth_blockNumber',
          params: [],
        }),
      });
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
    'web3-http': Web3HttpService;
  }
}
