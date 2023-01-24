import {
  HubConfig,
  getWeb3ConfigByNetwork,
  Network,
  Web3Provider,
  ExternalProvider,
} from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import { setOwner } from '@ember/application';
import { action } from '@ember/object';
import Owner from '@ember/owner';
import detectEthereumProvider from '@metamask/detect-provider';
import { BaseProvider } from '@metamask/providers';
import WConnetUniversalProvider from '@walletconnect/universal-provider';
import { getSdkError } from '@walletconnect/utils';
import { Web3Modal } from '@web3modal/standalone';

import { Emitter, SimpleEmitter } from './events';
import { TypedChannel } from './typed-channel';
import { VoidCallback } from './types';
import { WalletProviderId } from './wallet-providers';

const GET_PROVIDER_STORAGE_KEY = (chainId: number) =>
  `cardstack-chain-${chainId}-provider`;

interface ConnectionStrategyOptions {
  chainId: number;
  networkSymbol: Network;
  connectionManager: ChainConnectionManager;
}

type ConnectionManagerWalletEvent =
  | 'connected'
  | 'disconnected'
  | 'chain-changed'
  | 'websocket-disconnected';

type ConnectionManagerCrossTabEvent = 'cross-tab-connection';

export type ConnectionManagerEvent =
  | ConnectionManagerWalletEvent
  | ConnectionManagerCrossTabEvent;

const BROADCAST_CHANNEL_MESSAGES = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTED: 'CONNECTED',
} as const;

interface ConnectEvent {
  type: typeof BROADCAST_CHANNEL_MESSAGES.CONNECTED;
  providerId: WalletProviderId;
  session?: unknown;
}

interface DisconnectEvent {
  type: typeof BROADCAST_CHANNEL_MESSAGES.DISCONNECTED;
}
type ConnectionEvent = ConnectEvent | DisconnectEvent;

/**
 * # ConnectionManager
 * This class simplifies the interface to communicate with wallet providers (MetaMask or WalletConnect).
 * It also handles cross-tab communication and persistence of connection information across refreshes.
 * Cross-tab disconnection is handled internally while cross-tab connection is handled by emitting the event
 * to this class' consumer (layer 1 chain), which needs to set up a web3 instance first so that the event handlers
 * it has can work correctly as they use the web3 instance.
 *
 * This class emits a number of events that can be listened for with `ConnectionManager.on()`:
 *
 * - connected: A wallet is connected, or the address is changed
 * - disconnected: A wallet is disconnected
 * - chain-changed: A wallet's chain is updated or detected for the first time
 *
 *
 * This class does not, at the moment, store any state used directly by the UI besides providerId.
 */
export class ChainConnectionManager {
  storage: Storage;

  broadcastChannel: TypedChannel<ConnectionEvent>;
  strategy: ConnectionStrategy | undefined;
  chainId: number;
  networkSymbol: Network;
  simpleEmitter = new SimpleEmitter();

  constructor(networkSymbol: Network, chainId: number, owner: Owner) {
    setOwner(this, owner);

    this.storage =
      (owner.lookup('storage:local') as Storage) || window.localStorage;

    this.networkSymbol = networkSymbol;
    this.chainId = chainId;

    // we want to ensure that users don't get confused by different tabs having
    // different wallets connected so we communicate connections and disconnections across tabs
    this.broadcastChannel = new TypedChannel(
      `cardstack-layer-1-connection-sync`
    );
    this.broadcastChannel.addEventListener(
      'message',
      this.onBroadcastChannelMessage
    );
  }

  getProviderIdForChain(chainId: number) {
    return this.storage.getItem(GET_PROVIDER_STORAGE_KEY(chainId));
  }

  removeProviderFromStorage(chainId: number) {
    this.storage.removeItem(GET_PROVIDER_STORAGE_KEY(chainId));
  }

  addProviderToStorage(chainId: number, providerId: WalletProviderId) {
    this.storage.setItem(GET_PROVIDER_STORAGE_KEY(chainId), providerId);
  }

  get provider() {
    return this.strategy?.provider;
  }

  get providerId() {
    return this.strategy?.providerId;
  }

  reset() {
    this.strategy?.destroy();
    this.strategy = undefined;
  }

  private async setup(providerId: WalletProviderId) {
    this.strategy = this.createStrategy(
      this.chainId,
      this.networkSymbol,
      providerId
    );
    this.strategy.on('connected', this.onConnect);
    this.strategy.on('disconnected', this.onDisconnect);
    this.strategy.on('chain-changed', this.onChainChanged);
    this.strategy.on('websocket-disconnected', this.onWebsocketDisconnected);
    await this.strategy.setup();
  }

  createStrategy(
    chainId: number,
    networkSymbol: Network,
    providerId: WalletProviderId
  ) {
    if (providerId === 'metamask') {
      return new MetaMaskConnectionStrategy({
        connectionManager: this,
        chainId,
        networkSymbol,
      });
    } else if (providerId === 'wallet-connect') {
      return new WalletConnectConnectionStrategy({
        connectionManager: this,
        chainId,
        networkSymbol,
      });
    } else {
      throw new Error(`Unrecognised wallet provider id: ${providerId}`);
    }
  }

  async connect(
    setProvider: (provider: Web3Provider) => void,
    providerId: WalletProviderId
  ) {
    await this.setup(providerId);
    if (!this.strategy)
      throw new Error('Failed to setup strategy in layer 1 connection manager');
    if (!this.provider) throw new Error('Missing Provider');
    setProvider(new Web3Provider(this.provider as ExternalProvider));
    return await this.strategy.connect();
  }

  async reconnect(
    setProvider: (provider: Web3Provider) => void,
    providerId: WalletProviderId
  ) {
    await this.setup(providerId);
    setProvider(new Web3Provider(this.provider as ExternalProvider));
    await this.strategy?.reconnect();
  }

  disconnect() {
    this.strategy?.disconnect();
  }

  on(event: ConnectionManagerEvent, cb: VoidCallback) {
    return this.simpleEmitter.on(event, cb);
  }

  emit(event: ConnectionManagerEvent, ...args: unknown[]) {
    return this.simpleEmitter.emit(event, ...args);
  }

  @action
  onBroadcastChannelMessage(event: MessageEvent<ConnectionEvent>) {
    if (event.data.type === BROADCAST_CHANNEL_MESSAGES.DISCONNECTED) {
      this.onDisconnect(false);
    } else if (
      event.data.type === BROADCAST_CHANNEL_MESSAGES.CONNECTED &&
      !this.strategy
    ) {
      this.emit('cross-tab-connection', event.data);
    }
  }

  @action onDisconnect(broadcast: boolean) {
    if (!this.strategy) return;
    this.removeProviderFromStorage(this.chainId);
    this.emit('disconnected');
    if (broadcast)
      this.broadcastChannel?.postMessage({
        type: BROADCAST_CHANNEL_MESSAGES.DISCONNECTED,
      });
  }

  @action onConnect(accounts: string[]) {
    if (!this.strategy) return;
    this.addProviderToStorage(this.chainId, this.strategy.providerId);
    this.emit('connected', accounts);

    if (this.providerId) {
      this.broadcastChannel?.postMessage({
        type: BROADCAST_CHANNEL_MESSAGES.CONNECTED,
        providerId: this.providerId,
      });
    }
  }

  @action onChainChanged(chainId: number) {
    this.emit('chain-changed', chainId);
  }

  @action onWebsocketDisconnected() {
    this.emit('websocket-disconnected');
  }
}

export abstract class ConnectionStrategy
  implements Emitter<ConnectionManagerWalletEvent>
{
  private simpleEmitter: SimpleEmitter;

  // concrete classes will need to implement these
  abstract providerId: WalletProviderId;
  abstract setup(): Promise<unknown>;
  abstract reconnect(): Promise<void>;
  /**
   * Returns true if connect calls go through without errors/cancelation by user
   */
  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;

  // concrete classes may optionally implement these methods
  abstract destroy(): void;

  // networkSymbol and chainId are initialized in the constructor
  networkSymbol: Network;
  chainId: number;
  connectionManager: ChainConnectionManager;
  provider?: WalletConnectProviderish | BaseProvider;

  constructor(options: ConnectionStrategyOptions) {
    this.connectionManager = options.connectionManager;
    this.chainId = options.chainId;
    this.networkSymbol = options.networkSymbol;
    this.simpleEmitter = new SimpleEmitter();
  }

  on(event: ConnectionManagerWalletEvent, cb: VoidCallback) {
    return this.simpleEmitter.on(event, cb);
  }

  emit(event: ConnectionManagerWalletEvent, ...args: unknown[]) {
    return this.simpleEmitter.emit(event, ...args);
  }

  onDisconnect(broadcast = true) {
    this.emit('disconnected', broadcast);
  }

  onConnect(accounts: string[]) {
    this.emit('connected', accounts);
  }

  async emitChainIdChange(id?: number) {
    if (id) {
      this.emit('chain-changed', id);
      return;
    }

    if (!this.provider) {
      throw new Error('No provider present');
    }

    const chainId = parseInt(
      (await this.provider.request({
        method: 'eth_chainId',
      })) as string // even though we cast it to string some providers might return it as a number
    );

    if (isNaN(chainId)) {
      throw new Error(`Couldn't determine chainId`);
    }

    this.emit('chain-changed', chainId);
  }
}

class MetaMaskConnectionStrategy extends ConnectionStrategy {
  // this is initialized in the `setup` method of concrete classes
  provider?: BaseProvider;

  providerId: WalletProviderId = 'metamask';

  async setup() {
    const provider: BaseProvider | undefined =
      (await detectEthereumProvider()) as BaseProvider | undefined;

    if (!provider) {
      // TODO: some UI prompt for getting people to setup metamask
      console.log('Please install MetaMask!');
      return;
    }

    if (provider !== window.ethereum) {
      // TODO: some UI prompt to get people to disconnect their other wallets
      console.error('Do you have multiple wallets installed?');
      return;
    }

    provider.on('accountsChanged', (accounts: string[]) => {
      if (!accounts.length) {
        this.onDisconnect();
      } else {
        this.onConnect(accounts);
      }
    });

    // Subscribe to chainId change
    provider.on('chainChanged', (changedChainId: string) => {
      this.emitChainIdChange(parseInt(changedChainId));
    });

    // Note that this is, following EIP-1193, about connection of the wallet to the
    // chain, not our dapp to the wallet
    provider.on('disconnect', (error: { code: number; message: string }) => {
      console.error(error);
      this.onDisconnect();
    });

    this.provider = provider;
  }

  async connect() {
    if (!this.provider)
      throw new Error('Trying to connect before provider is set');
    const accounts = (await this.provider.request({
      method: 'eth_accounts',
    })) as string[] | undefined;
    if (accounts?.length) {
      // so we had accounts before, let's just connect to them now
      // metamask's disconnection is a faux-disconnection - the wallet still thinks
      // it is connected to the account so it will not fire the connection/account change events
      this.onConnect(accounts);
    } else {
      // otherwise we want to trigger the extension prompt
      try {
        await this.provider.request({
          method: 'eth_requestAccounts',
        });
      } catch (e) {
        /**
         * Based on examples from https://docs.metamask.io/guide/ethereum-provider.html#using-the-provider
         * 4001 is the EIP-1193 userRejectedRequest error
         * If this happens, the user rejected the connection request.
         */
        if (e.code === 4001) {
          return false;
        } else {
          throw e;
        }
      }
    }

    this.emitChainIdChange();

    return true;
  }

  // metamask actually doesn't allow you to disconnect via its API
  // all we do here is fire the disconnect callback
  async disconnect() {
    this.onDisconnect();
    return;
  }

  // unlike the connect method, here we do not try to open the popup (eth_requestAccounts) if there is no account
  async reconnect() {
    if (!this.provider) {
      throw new Error('No provider present');
    }
    const accounts = await this.provider.request({ method: 'eth_accounts' });
    if (Array.isArray(accounts) && accounts.length) {
      // metamask's disconnection is a faux-disconnection - the wallet still thinks
      // it is connected to the account so it will not fire the connection/account change events
      this.onConnect(accounts);
      this.emitChainIdChange();
    } else {
      // if we didn't find accounts, then the stored provider key is not useful, delete it
      this.connectionManager.removeProviderFromStorage(this.chainId);
    }
  }

  // eslint-disable-next-line ember/classic-decorator-hooks
  destroy() {
    // remove all listeners that previous instances of metamask connections have added
    // otherwise disconnecting and reconnecting might cause "duplicate" event listeners
    this.provider?.removeAllListeners();
  }
}

type WalletConnectProviderish = WConnetUniversalProvider;
// TODO: handle test
// | TestWalletConnectProvider;

const wcWeb3Modal = new Web3Modal({
  projectId: config.walletConnectProjectId,
  themeMode: 'light',
  themeColor: 'teal',
  themeBackground: 'themeColor',
});

const EIP155 = 'eip155';

class WalletConnectConnectionStrategy extends ConnectionStrategy {
  providerId: WalletProviderId = 'wallet-connect';
  provider?: WalletConnectProviderish;

  // eslint-disable-next-line ember/classic-decorator-hooks, @typescript-eslint/no-empty-function
  destroy() {}

  constructor(
    options: ConnectionStrategyOptions & { provider?: WConnetUniversalProvider }
  ) {
    super(options);
    this.provider = options.provider;
  }

  async setup() {
    const { chainId } = this;

    if (!this.provider) {
      this.provider = await WConnetUniversalProvider.init({
        projectId: config.walletConnectProjectId,
        metadata: {
          name: 'Cardstack Safe Tools',
          description: '',
          url: window.location.origin,
          icons: [], // TODO: Add favicon to use here too
        },
      });
    }

    // Subscribe to accounts change
    this.provider.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length) this.onConnect(accounts);
    });

    // Subscribe to chainId change
    this.provider.on('chainChanged', (changedChainId: number) => {
      this.emitChainIdChange(changedChainId);
    });

    this.provider.on('display_uri', async (uri: string) => {
      wcWeb3Modal.openModal({
        uri,
        standaloneChains: [`eip155:${chainId}`],
      });
    });

    // Subscribe to session disconnection
    // This is how WalletConnect informs us if we disconnect the Dapp
    // from the wallet side. Unlike MetaMask, listening to 'accountsChanged'
    // does not work.
    this.provider.on('disconnect', (code: number, reason: string) => {
      console.log('disconnect from wallet connect', code, reason);
      this.onDisconnect(false);
    });

    this.provider.on('websocket-disconnected', () => {
      this.emit('websocket-disconnected');
      this.disconnect();
    });

    return;
  }

  async connect() {
    const { chainId } = this;

    try {
      const hubConfigApi = new HubConfig(config.hubUrl);
      const hubConfigResponse = await hubConfigApi.getConfig();

      const { rpcNodeHttpsUrl } = getWeb3ConfigByNetwork(
        hubConfigResponse,
        this.networkSymbol
      );

      await this.provider?.connect({
        namespaces: {
          [EIP155]: {
            // @ts-expect-error wc types are not up-to-date
            methods: [
              'eth_sendTransaction',
              'eth_signTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
              'eth_signTypedData_v4',
            ],
            chains: [`${EIP155}:${chainId}`],
            events: ['chainChanged', 'accountsChanged'],
            rpcMap: {
              [chainId]: rpcNodeHttpsUrl,
            },
          },
        },
      });

      const accounts = (await this.provider?.enable()) || [];

      this.onConnect(accounts);
      return true;
    } catch (e) {
      const userRejectedCode = getSdkError('USER_REJECTED').code;

      if (e.code === userRejectedCode) {
        return false;
      }
      throw e;
    } finally {
      // Modal is open on display_uri event
      wcWeb3Modal.closeModal();
    }
  }

  async disconnect() {
    await this.provider?.disconnect();
    this.onDisconnect();
  }

  async reconnect() {
    // if the qr code modal ever pops up when the application is loading, it's time to revisit this code
    // this typically should not open the modal if CustomStorageWalletConnect is initialized with a
    // valid session from localStorage
    await this.provider?.enable();
  }
}
