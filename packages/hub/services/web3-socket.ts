import Web3 from 'web3';
import config from 'config';
import Logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';

let log = Logger('service:web3-socket');

export default class Web3SocketService {
  web3: Web3 | undefined;
  rpcURL = config.get('web3.layer2RpcNodeWssUrl') as string;

  getInstance() {
    if (!this.web3) {
      try {
        this.web3 = this.initializeWeb3();
      } catch (e) {
        log.error(`Error encountered while trying to connect to rpc node with url ${this.rpcURL}`, e);
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
    /**
     * ERROR and CLOSE are tacked on dynamically and not properly typed
     * + the on method is incorrect.
     */
    type CorrectedProvider = InstanceType<typeof Web3['providers']['WebsocketProvider']> & {
      ERROR: string;
      CLOSE: string;
      on(...args: any[]): void;
    };

    let provider = new Web3.providers.WebsocketProvider(this.rpcURL, {
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
    }) as unknown as CorrectedProvider;

    provider.on(provider.ERROR, function (error: Error) {
      log.error('Web 3 websocket provider error', error);
      Sentry.captureException(error, {
        tags: {
          action: 'web3-socket-connection',
        },
      });
    });

    /**
     * This is actually a websocket close event
     */
    provider.on(provider.CLOSE, function (event: any) {
      log.error('Web 3 websocket provider connection is closed', event);
      Sentry.captureException(event, {
        tags: {
          action: 'web3-socket-connection',
        },
      });
    });
    web3.setProvider(provider);

    return web3;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'web3-socket': Web3SocketService;
  }
}
