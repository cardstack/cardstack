import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { defer } from 'rsvp';
import Web3 from 'web3';
import { IConnector } from '@walletconnect/types';
import WalletConnectProvider from '@cardstack/wc-provider';
import { task } from 'ember-concurrency-decorators';

import { Emitter, SimpleEmitter, UnbindEventListener } from '../events';
import WalletInfo from '../wallet-info';
import CustomStorageWalletConnect from '../wc-connector';
import {
  Layer2Web3Strategy,
  Layer2NetworkSymbol,
  Layer2ChainEvent,
} from './types';
import {
  networkIds,
  getConstantByNetwork,
  getSDK,
  IHubAuth,
} from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';
import config from '../../config/environment';
import { TaskGenerator } from 'ember-concurrency';
import { action } from '@ember/object';
import { TypedChannel } from '../typed-channel';
import { getLayer2RpcWssNodeUrl } from '../features';
import * as Sentry from '@sentry/browser';

const BROADCAST_CHANNEL_MESSAGES = {
  CONNECTED: 'CONNECTED',
} as const;

interface Layer2ConnectEvent {
  type: typeof BROADCAST_CHANNEL_MESSAGES.CONNECTED;
  session?: any;
}

const BRIDGE = 'https://safe-walletconnect.gnosis.io/';

export default abstract class Layer2ChainWeb3Strategy
  implements Layer2Web3Strategy, Emitter<Layer2ChainEvent>
{
  chainId: number;
  networkSymbol: Layer2NetworkSymbol;
  provider: WalletConnectProvider | undefined;
  simpleEmitter = new SimpleEmitter();

  defaultTokenContractAddress?: string;
  web3!: Web3;
  #hubAuthApi!: IHubAuth;
  #broadcastChannel: TypedChannel<Layer2ConnectEvent>;
  @tracked walletInfo: WalletInfo;
  @tracked walletConnectUri: string | undefined;
  @tracked waitForAccountDeferred = defer();
  @tracked isInitializing = true;

  @reads('provider.connector') connector!: IConnector;

  constructor(networkSymbol: Layer2NetworkSymbol) {
    this.chainId = networkIds[networkSymbol];
    this.networkSymbol = networkSymbol;
    this.walletInfo = new WalletInfo([]);
    this.#broadcastChannel = new TypedChannel(
      `cardstack-layer-2-connection-sync`
    );
    this.#broadcastChannel.addEventListener(
      'message',
      this.onBroadcastChannelMessage
    );
  }

  @action onBroadcastChannelMessage(event: MessageEvent<Layer2ConnectEvent>) {
    // only try to connect if we weren't already connected
    // if we were already connected and there was an account change
    // we should be receiving the same "accountsChanged" event in each tab
    // from WalletConnect
    if (
      event.data.type === BROADCAST_CHANNEL_MESSAGES.CONNECTED &&
      !this.isConnected
    ) {
      taskFor(this.initializeTask).perform(event.data.session);
    }
  }

  @task *initializeTask(session?: any): TaskGenerator<void> {
    let connectorOptions;
    if (session) {
      connectorOptions = { session };
    } else {
      connectorOptions = {
        bridge: BRIDGE,
      };
    }
    this.web3 = new Web3();

    let rpcWss = getLayer2RpcWssNodeUrl(this.networkSymbol);
    this.provider = new WalletConnectProvider({
      chainId: this.chainId,
      rpc: {
        [networkIds[this.networkSymbol]]: getConstantByNetwork(
          'rpcNode',
          this.networkSymbol
        ),
      },
      rpcWss: {
        [networkIds[this.networkSymbol]]: rpcWss,
      },
      connector: new CustomStorageWalletConnect(connectorOptions, this.chainId),
    });

    this.provider.on('websocket-connected', () => {
      console.log('websocket connected');
      Sentry.addBreadcrumb({
        type: 'debug',
        message: 'Websocket connected',
        data: {
          url: rpcWss,
        },
        level: Sentry.Severity.Info,
      });
    });

    this.provider.on('websocket-disconnected', (event: CloseEvent) => {
      this.simpleEmitter.emit('websocket-disconnected');
      this.disconnect();
      console.log('websocket disconnected');
      Sentry.addBreadcrumb({
        type: 'debug',
        message: 'Websocket connection closed',
        data: {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          url: rpcWss,
        },
        // unsure about 1001 since this could also happen due to server failure
        // but also can happen due to closing the tab normally
        // unlike other codes which will only get here after the websocket provider
        // fails to reconnect, 1000 and 1001 will get here immediately if the closing was clean
        level: [1000, 1001].includes(event.code)
          ? Sentry.Severity.Info
          : Sentry.Severity.Error,
      });
    });

    this.web3.setProvider(this.provider as any);

    this.connector.on('display_uri', (err, payload) => {
      if (err) {
        console.error('Error in display_uri callback', err);
        return;
      }
      // if we get here when a user loads a page, then it means that the user did not have
      // a connection from local storage. We can safely say they are initialized
      this.isInitializing = false;
      this.simpleEmitter.emit('initialized');
      this.walletConnectUri = payload.params[0];
    });

    this.provider.on('accountsChanged', async (accounts: string[]) => {
      try {
        this.#hubAuthApi = await getSDK('HubAuth', this.web3, config.hubURL);
        await this.updateWalletInfo(accounts);
        this.#broadcastChannel.postMessage({
          type: BROADCAST_CHANNEL_MESSAGES.CONNECTED,
          session: this.connector?.session,
        });
      } catch (e) {
        console.error(
          'Error initializing layer 2 wallet and services. Wallet may be connected to an unsupported chain'
        );
        console.error(e);
        this.disconnect();
      } finally {
        this.isInitializing = false;
        this.simpleEmitter.emit('initialized');
      }
    });

    this.provider.on('chainChanged', async (connectedChainId: number) => {
      if (connectedChainId !== this.chainId) {
        this.simpleEmitter.emit('incorrect-chain');
        this.disconnect();
      } else {
        this.simpleEmitter.emit('correct-chain');
      }
    });

    this.connector.on('disconnect', (error) => {
      if (error) {
        console.error('error disconnecting', error);
        throw error;
      }
      this.onDisconnect();
    });

    yield this.provider.enable();
  }

  async updateWalletInfo(accounts: string[]) {
    let newWalletInfo = new WalletInfo(accounts);
    if (this.walletInfo.isEqualTo(newWalletInfo)) {
      return;
    }

    if (this.walletInfo.firstAddress && newWalletInfo.firstAddress) {
      this.simpleEmitter.emit('account-changed');
    }

    this.walletInfo = newWalletInfo;
    if (accounts.length) {
      this.waitForAccountDeferred.resolve();
    } else {
      this.waitForAccountDeferred = defer();
    }
  }

  clearWalletInfo() {
    this.updateWalletInfo([]);
  }

  onDisconnect() {
    this.clearWalletInfo();
    this.walletConnectUri = undefined;

    this.simpleEmitter.emit('disconnect');

    // we always want to re-generate the uri, because the 'disconnect' event from WalletConnect
    // covers clicking the 'cancel' button in the wallet/mobile app
    // if we don't re-generate the uri, then users might be stuck with the old one that cannot
    // scan/fails silently
    setTimeout(() => {
      console.log('initializing');
      taskFor(this.initializeTask).perform();
    }, 500);
  }

  get isConnected(): boolean {
    return this.walletInfo.accounts.length > 0;
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  async authenticate(): Promise<string> {
    return this.#hubAuthApi.authenticate();
  }

  checkHubAuthenticationValid(authToken: string): Promise<boolean> {
    return this.#hubAuthApi.checkValidAuth(authToken);
  }

  async disconnect(): Promise<void> {
    await this.provider?.disconnect();
  }

  on(event: Layer2ChainEvent, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }
}
