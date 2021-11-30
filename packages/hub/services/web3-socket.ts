import Web3 from 'web3';
import config from 'config';
import Logger from '@cardstack/logger';
import { getConstantByNetwork } from '@cardstack/cardpay-sdk';

interface Web3Config {
  network: string;
}

const { network } = config.get('web3') as Web3Config;

export default class Web3SocketService {
  private web3: Web3 | undefined;

  getInstance() {
    if (!this.web3) {
      let rpcURL = getConstantByNetwork('rpcWssNode', network);
      this.web3 = new Web3(rpcURL);
      let provider = this.createWebsocketProvider(rpcURL, {
        timeout: 30000,
        reconnect: {
          auto: true,
          delay: 1000,
          onTimeout: true,
          maxAttempts: 10,
        },
        clientConfig: {
          keepalive: true,
          keepaliveInterval: 60000,
          maxReceivedFrameSize: 100000000,
          maxReceivedMessageSize: 100000000,
        },
      });
      this.web3.setProvider(provider);
    }
    return this.web3;
  }

  createWebsocketProvider(...args: ConstructorParameters<typeof Web3['providers']['WebsocketProvider']>) {
    let [host, options] = args;
    return new Web3.providers.WebsocketProvider(host, options);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'web3-socket': Web3SocketService;
  }
}
