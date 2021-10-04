import Web3 from 'web3';
import config from 'config';
import Logger from '@cardstack/logger';
import { getConstantByNetwork } from '@cardstack/cardpay-sdk';

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
      this.web3 = new Web3(rpcURL);
    }
    return this.web3;
  }

  async isAvailable(): Promise<boolean> {
    let rpcURL = getConstantByNetwork('rpcNode', network);
    try {
      let response = await fetch(rpcURL);
      return response.status === 200;
    } catch (e) {
      log.error(`Error encountered while checking if rpc node ${rpcURL} is available`, e);
      return false;
    }
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    web3: Web3Service;
  }
}
