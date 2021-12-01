import Web3 from 'web3';
import config from 'config';
import Logger from '@cardstack/logger';
import { getConstantByNetwork } from '@cardstack/cardpay-sdk';
import * as Sentry from '@sentry/node';

interface Web3Config {
  network: string;
}

const { network } = config.get('web3') as Web3Config;
let rpcURL = getConstantByNetwork('rpcWssNode', network);
let log = Logger('service:web3-socket');

export default class Web3SocketService {
  private web3: Web3 | undefined;

  getInstance() {
    if (!this.web3) {
      try {
        this.web3 = this.initializeWeb3();
      } catch (e) {
        log.error(`Error encountered while trying to connect to rpc node with url ${rpcURL}`, e);
        Sentry.captureException(e, {
          tags: {
            action: 'web3-socket-connection',
          },
        });
        throw e;
      }
    }
    return this.web3;
  }

  initializeWeb3() {
    let web3 = new Web3();
    let provider = new Web3.providers.WebsocketProvider(rpcURL, {
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
    web3.setProvider(provider);

    return web3;
  }

  // TODO: disconnect handling. This should also log to Sentry. Maybe in a separate PR?
}

declare module '@cardstack/di' {
  interface KnownServices {
    'web3-socket': Web3SocketService;
  }
}
