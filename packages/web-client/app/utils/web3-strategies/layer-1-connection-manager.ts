import detectEthereumProvider from '@metamask/detect-provider';
import Web3 from 'web3';
import { NetworkSymbol } from './types';
import WalletConnectProvider from '@walletconnect/web3-provider';
import WalletConnectQRCodeModal from '@walletconnect/qrcode-modal';
import config from '../../config/environment';
import CustomStorageWalletConnect, {
  clearWalletConnectStorage,
} from '../wc-connector';
import { Emitter, SimpleEmitter } from '../events';
import { WalletProviderId } from '../wallet-providers';
import { action } from '@ember/object';

const GET_PROVIDER_STORAGE_KEY = (chainId: string | number) =>
  `cardstack-chain-${chainId}-provider`;
const WALLET_CONNECT_BRIDGE = 'https://safe-walletconnect.gnosis.io/';

interface ConnectionManagerOptions {
  chainId: number;
  networkSymbol: NetworkSymbol;
}

type ConnectionManagerEvents = 'connected' | 'disconnected' | 'incorrect-chain';

const BROADCAST_CHANNEL_MESSAGES = {
  DISCONNECTED: 'DISCONNECTED',
} as const;

/**
 * # ConnectionManager
 * This class instantiates a web3 provider given a WalletProviderId. It then handles the EIP-1193
 * events that come from the web3 provider and filters them for events that we want to handle
 * in the Dapp:
 *
 * - connected: A wallet is connected, or the address is changed
 * - disconnected: A wallet is disconnected
 * - incorrect-chain: A wallet is connected to the wrong chain
 *
 * It handles cross-tab communication and persistence of connection information across refreshes.
 * This class does not, at the moment, store any state used directly by the UI besides providerId.
 */
export abstract class ConnectionManager
  implements Emitter<ConnectionManagerEvents> {
  networkSymbol: NetworkSymbol;
  chainId: number;
  protected simpleEmitter: SimpleEmitter;
  protected broadcastChannel: BroadcastChannel;
  protected provider: any;
  protected connected = false;
  abstract providerId: WalletProviderId;

  constructor(options: ConnectionManagerOptions) {
    this.networkSymbol = options.networkSymbol;
    this.chainId = options.chainId;
    this.simpleEmitter = new SimpleEmitter();
    // the broadcast channel is really for metamask disconnections
    // since metamask doesn't allow you to disconnect from the dapp side
    // we want to ensure that users don't get confused by different tabs having
    // different wallets connected
    this.broadcastChannel = new BroadcastChannel(
      `cardstack-connection-manager-${this.chainId}`
    );
    this.broadcastChannel.addEventListener(
      'message',
      this.onBroadcastChannelMessage
    );
  }

  static create(
    providerId: WalletProviderId,
    options: ConnectionManagerOptions
  ): ConnectionManager {
    if (providerId === 'metamask') {
      return new MetaMaskConnectionManager(options);
    } else if (providerId === 'wallet-connect') {
      return new WalletConnectConnectionManager(options);
    } else {
      throw new Error(`Unrecognised id for connection manager: ${providerId}`);
    }
  }

  static getProviderIdForChain(chainId: string | number) {
    return window.localStorage.getItem(GET_PROVIDER_STORAGE_KEY(chainId));
  }

  static removeProviderFromStorage(chainId: string | number) {
    window.localStorage.removeItem(GET_PROVIDER_STORAGE_KEY(chainId));
  }

  static addProviderToStorage(
    chainId: string | number,
    providerId: WalletProviderId
  ) {
    window.localStorage.setItem(GET_PROVIDER_STORAGE_KEY(chainId), providerId);
  }

  on(event: ConnectionManagerEvents, cb: Function) {
    return this.simpleEmitter.on(event, cb);
  }

  emit(event: ConnectionManagerEvents, ...args: any[]) {
    return this.simpleEmitter.emit(event, ...args);
  }

  @action
  onBroadcastChannelMessage(event: MessageEvent) {
    if (event.data === BROADCAST_CHANNEL_MESSAGES.DISCONNECTED) {
      this.onDisconnect(false);
    }
  }

  onDisconnect(broadcast = true) {
    // NOTE: if the ConnectionManager thinks that it's disconnected and Layer1Chain thinks
    // that it's connected, this can result in never being able to disconnect
    // The problem here is that WalletConnect gives you two disconnect events when you disconnect
    // from the Dapp
    // and one when you disconnect from the wallet
    if (!this.connected) {
      return;
    }
    this.connected = false;
    ConnectionManager.removeProviderFromStorage(this.chainId);
    if (broadcast)
      this.broadcastChannel.postMessage(
        BROADCAST_CHANNEL_MESSAGES.DISCONNECTED
      );
    // the layer1-chain will destroy the instance of ConnectionManager so we emit as the last item
    this.emit('disconnected');
  }

  onConnect(accounts: string[]) {
    this.connected = true;
    ConnectionManager.addProviderToStorage(this.chainId, this.providerId);
    this.emit('connected', accounts);
  }

  onIncorrectChain() {
    ConnectionManager.removeProviderFromStorage(this.chainId);
    this.emit('incorrect-chain');
  }

  abstract reconnect(): Promise<void>;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  // create provider and setup event listeners here
  // also call web3.setProvider
  abstract setup(web3: Web3): Promise<any>;

  destroy() {
    this.broadcastChannel.close();
  }
}

class MetaMaskConnectionManager extends ConnectionManager {
  providerId = 'metamask' as WalletProviderId;

  async setup(web3: Web3) {
    let provider: any | undefined = await detectEthereumProvider();

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

    // remove all listeners that previous instances of metamask connections have added
    // otherwise disconnecting and reconnecting might cause "duplicate" event listeners
    provider.removeAllListeners();

    provider.on('accountsChanged', (accounts: string[]) => {
      if (!accounts.length) {
        this.onDisconnect();
      } else {
        this.onConnect(accounts);
      }
    });

    // Subscribe to chainId change
    provider.on('chainChanged', (changedChainId: number) => {
      if (String(changedChainId) !== String(this.chainId)) {
        console.error('connected to incorrect chain');
        this.onIncorrectChain();
      }
    });

    // Note that this is, following EIP-1193, about connection of the wallet to the
    // chain, not our dapp to the wallet
    provider.on('disconnect', (error: { code: number; message: string }) => {
      console.error(error);
      this.onDisconnect();
    });

    this.provider = provider;
    web3?.setProvider(provider);
  }

  async connect() {
    if (!this.provider)
      throw new Error('Trying to connect before provider is set');
    let accounts = await this.provider.request({
      method: 'eth_accounts',
    });
    if (accounts.length) {
      // so we had accounts before, let's just connect to them now
      // metamask's disconnection is a faux-disconnection - the wallet still thinks
      // it is connected to the account so it will not fire the connection/account change events
      this.onConnect(accounts);
    } else {
      // otherwise we want to trigger the extension prompt
      await this.provider.request({
        method: 'eth_requestAccounts',
      });
    }
    return;
  }

  // metamask actually doesn't allow you to disconnect via its API
  // all we do here is fire the disconnect callback
  async disconnect() {
    this.onDisconnect();
    return;
  }

  // unlike the connect method, here we do not try to open the popup (eth_requestAccounts) if there is no account
  async reconnect() {
    let provider: any | undefined = await detectEthereumProvider();
    let accounts = await provider.request({ method: 'eth_accounts' });
    if (accounts.length) {
      // metamask's disconnection is a faux-disconnection - the wallet still thinks
      // it is connected to the account so it will not fire the connection/account change events
      this.onConnect(accounts);
    } else {
      // if we didn't find accounts, then the stored provider key is not useful, delete it
      window.localStorage.removeItem(GET_PROVIDER_STORAGE_KEY(this.chainId));
      return;
    }
  }
}

class WalletConnectConnectionManager extends ConnectionManager {
  providerId = 'wallet-connect' as WalletProviderId;

  async setup(web3: Web3) {
    let { chainId } = this;
    // in case we've disconnected, we should clear wallet connect's local storage data as well
    // As per https://github.com/WalletConnect/walletconnect-monorepo/issues/258 there is no way
    // for us to tell if this is valid before we connect, but we don't want to connect to something
    // if we have disconnected from it in the first place (since we cleared our local storage identification of provider)
    if (ConnectionManager.getProviderIdForChain(chainId) !== this.providerId) {
      clearWalletConnectStorage(chainId);
    }
    let provider = new WalletConnectProvider({
      chainId,
      infuraId: config.infuraId,
      // based on https://github.com/WalletConnect/walletconnect-monorepo/blob/7aa9a7213e15489fa939e2e020c7102c63efd9c4/packages/providers/web3-provider/src/index.ts#L47-L52
      connector: new CustomStorageWalletConnect(
        {
          bridge: WALLET_CONNECT_BRIDGE,
          qrcodeModal: WalletConnectQRCodeModal,
        },
        chainId
      ),
    });

    // Subscribe to accounts change
    provider.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length) this.onConnect(accounts);
    });

    // Subscribe to chainId change
    provider.on('chainChanged', (changedChainId: number) => {
      if (String(changedChainId) !== String(chainId)) {
        console.error('connected to incorrect chain');
        this.onIncorrectChain();
      }
    });

    // Subscribe to session disconnection
    // This is how WalletConnect informs us if we disconnect the Dapp
    // from the wallet side. Unlike MetaMask, listening to 'accountsChanged'
    // does not work.
    provider.on('disconnect', (code: number, reason: string) => {
      console.log('disconnect from wallet connect', code, reason);
      this.onDisconnect(false);
    });

    this.provider = provider;
    // ts is not happy with WalletConnectProvider
    web3.setProvider(provider as any);
    return;
  }

  async connect() {
    return await this.provider.enable();
  }

  async disconnect() {
    return await this.provider.disconnect();
  }

  async reconnect() {
    // if the qr code modal ever pops up when the application is loading, it's time to revisit this code
    // this typically should not open the modal if CustomStorageWalletConnect is initialized with a
    // valid session from localStorage
    return await this.provider.enable();
  }
}
