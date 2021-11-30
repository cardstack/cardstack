import Web3 from 'web3';
import WebSocket from 'ws';
import config from 'config';
import Logger from '@cardstack/logger';
import { getConstantByNetwork } from '@cardstack/cardpay-sdk';

interface Web3Config {
  network: string;
}

const { network } = config.get('web3') as Web3Config;
let log = Logger('service:web3-socket');

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

  async isAvailable(): Promise<boolean> {
    let rpcURL = getConstantByNetwork('rpcWssNode', network) + 'x'; // Should be invalid!
    console.log('url', rpcURL);

    try {
      return await new Promise((resolve, reject) => {
        let ws = new WebSocket(rpcURL);

        ws.on('open', function open() {
          return resolve(true);
        });

        ws.on('error', function error(err: Error) {
          log.error(`RPC node ${rpcURL} is not available: ${err}`);
          reject(false);
        });
      });
    } catch (e) {
      log.error(`Error encountered while checking if rpc node ${rpcURL} is available`, e);
      return false;
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'web3-socket': Web3SocketService;
  }
}
