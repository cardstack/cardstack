import Web3 from 'web3';
import config from 'config';
import { getConstantByNetwork } from '@cardstack/cardpay-sdk';

interface Web3Config {
  network: string;
}

const { network } = config.get('web3') as Web3Config;

export default class Web3Service {
  private web3: Web3 | undefined;

  getInstance() {
    if (!this.web3) {
      let rpcURL = getConstantByNetwork('rpcNode', network);
      this.web3 = new Web3(rpcURL);
    }
    return this.web3;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    web3: Web3Service;
  }
}
