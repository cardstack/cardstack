import WalletConnect from '@walletconnect/client';
import QRCodeModal from '@walletconnect/qrcode-modal';
import HttpConnection from '@walletconnect/http-connection';
import {
  payloadId,
  signingMethods,
  parsePersonalSign,
  getRpcUrl,
} from '@walletconnect/utils';
import {
  IRPCMap,
  IConnector,
  IJsonRpcRequest,
  IJsonRpcResponseSuccess,
  IWalletConnectProviderOptions,
  IQRCodeModalOptions,
} from '@walletconnect/types';
import * as Sentry from '@sentry/browser';

import CacheSubprovider from 'web3-provider-engine/subproviders/cache';
import FixtureSubprovider from 'web3-provider-engine/subproviders/fixture';
import FilterSubprovider from 'web3-provider-engine/subproviders/filters';
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet';
import NonceSubprovider from 'web3-provider-engine/subproviders/nonce-tracker';
import SubscriptionsSubprovider from 'web3-provider-engine/subproviders/subscriptions';
import { JsonRpcRequest, JsonRpcResponse } from 'json-rpc-engine';
import { Provider } from 'eth-block-tracker';
import { JsonRpcPayload } from 'web3-core-helpers';
import BlockTracker, {
  ExtendedProviderEngine,
  TypedWebsocketProviderWithConstructor,
  WebsocketProvider,
} from './block-tracker';

export interface ICardstackWalletConnectProviderOptions
  extends IWalletConnectProviderOptions {
  rpcWss: IRPCMap;
}

const MIN_RECONNECTION_INTERVAL = 5000;

class WalletConnectProvider extends ExtendedProviderEngine {
  public bridge = 'https://bridge.walletconnect.org';
  public qrcode = true;
  public qrcodeModal = QRCodeModal;
  public qrcodeModalOptions: IQRCodeModalOptions | undefined = undefined;
  public rpc: IRPCMap | null = null;
  public rpcWss: IRPCMap;
  public http: HttpConnection | null = null;
  public wc: IConnector;
  public isConnecting = false;
  public connected = false;
  public connectCallbacks: any[] = [];
  public accounts: string[] = [];
  public chainId!: number;
  public rpcUrl = '';
  public websocketProvider!: TypedWebsocketProviderWithConstructor;
  public networkId!: number;
  public infuraId?: string;
  private lastReconnection = -Infinity;

  constructor(opts: ICardstackWalletConnectProviderOptions) {
    super({
      blockTracker: new BlockTracker({
        provider: new WebsocketProvider(
          opts.rpcWss[opts.chainId!]
        ) as unknown as Provider,
      }),
    });
    let rpcWss: IRPCMap = opts.rpcWss || null;
    let chainId: number = opts.chainId!;
    let websocketProvider = this.blockTracker.provider;
    //@ts-ignore allow assignment of new property
    websocketProvider.sendAsync = function <T, U>(
      this: TypedWebsocketProviderWithConstructor,
      req: JsonRpcRequest<T>,
      cb: (err: Error, res: JsonRpcResponse<U>) => void
    ): void {
      this.send(
        req as unknown as JsonRpcPayload,
        cb as (error: Error | null, result?: unknown) => void
      );
    };
    this.rpcWss = rpcWss;
    this.chainId = chainId;
    this.websocketProvider = websocketProvider;
    this.bindSocketListeners();
    this.bridge = opts.connector
      ? opts.connector.bridge
      : opts.bridge || 'https://bridge.walletconnect.org';
    this.qrcode = typeof opts.qrcode === 'undefined' || opts.qrcode !== false;
    this.qrcodeModal = opts.qrcodeModal || this.qrcodeModal;
    this.qrcodeModalOptions = opts.qrcodeModalOptions;
    this.wc =
      opts.connector ||
      new WalletConnect({
        bridge: this.bridge,
        qrcodeModal: this.qrcode ? this.qrcodeModal : undefined,
        qrcodeModalOptions: this.qrcodeModalOptions,
        storageId: opts?.storageId,
        signingMethods: opts?.signingMethods,
        clientMeta: opts?.clientMeta,
      });
    this.rpc = opts.rpc || null;
    if (
      !this.rpc &&
      (!opts.infuraId ||
        typeof opts.infuraId !== 'string' ||
        !opts.infuraId.trim())
    ) {
      throw new Error(
        'Missing one of the required parameters: rpc or infuraId'
      );
    }
    this.infuraId = opts.infuraId || '';
    this.initialize();
  }

  get isWalletConnect() {
    return true;
  }

  get connector() {
    return this.wc;
  }

  get walletMeta() {
    return this.wc.peerMeta;
  }

  // Connect with a wallet and return the addresses of all available
  // accounts.
  enable = async (): Promise<string[]> => {
    const wc = await this.getWalletConnector();
    if (wc) {
      this.start();
      this.subscribeWalletConnector();
      return wc.accounts;
    } else {
      throw new Error('Failed to connect to WalleConnect');
    }
  };

  request = async (payload: any): Promise<any> => {
    return this.send(payload);
  };

  send = async (payload: any, callback?: any): Promise<any> => {
    // Web3 1.0 beta.38 (and above) calls `send` with method and parameters
    if (typeof payload === 'string') {
      const method = payload;
      let params = callback;
      // maintaining the previous behavior where personal_sign could be non-hex string
      if (method === 'personal_sign') {
        params = parsePersonalSign(params);
      }

      return this.sendAsyncPromise(method, params);
    }

    // ensure payload includes id and jsonrpc
    payload = { id: payloadId(), jsonrpc: '2.0', ...payload };

    // maintaining the previous behavior where personal_sign could be non-hex string
    if (payload.method === 'personal_sign') {
      payload.params = parsePersonalSign(payload.params);
    }

    // Web3 1.0 beta.37 (and below) uses `send` with a callback for async queries
    if (callback) {
      this.sendAsync(payload, callback);
      return;
    }

    return this.sendAsyncPromise(payload.method, payload.params);
  };

  onConnect = (callback: any) => {
    this.connectCallbacks.push(callback);
  };

  triggerConnect = (result: any) => {
    if (this.connectCallbacks && this.connectCallbacks.length) {
      this.connectCallbacks.forEach((callback) => callback(result));
    }
  };

  async disconnect() {
    this.close();
  }

  async close() {
    const wc = await this.getWalletConnector({ disableSessionCreation: true });
    await wc.killSession();
    await this.onDisconnect();
  }

  async handleRequest(payload: any) {
    try {
      let response;
      let result: any = null;
      const wc = await this.getWalletConnector();
      switch (payload.method) {
        case 'wc_killSession':
          await this.close();
          result = null;
          break;
        case 'eth_accounts':
          result = wc.accounts;
          break;
        case 'eth_coinbase':
          result = wc.accounts[0];
          break;
        case 'eth_chainId':
          result = wc.chainId;
          break;
        case 'net_version':
          result = wc.chainId;
          break;
        case 'eth_uninstallFilter':
          this.sendAsync(payload, (_: any) => _);
          result = true;
          break;
        default:
          response = await this.handleOtherRequests(payload);
      }
      if (response) {
        return response;
      }
      return this.formatResponse(payload, result);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async handleOtherRequests(payload: any): Promise<IJsonRpcResponseSuccess> {
    if (
      !signingMethods.includes(payload.method) &&
      payload.method.startsWith('eth_')
    ) {
      return this.handleReadRequests(payload);
    }
    const wc = await this.getWalletConnector();
    const result = await wc.sendCustomRequest(payload);
    return this.formatResponse(payload, result);
  }

  async handleReadRequests(payload: any): Promise<IJsonRpcResponseSuccess> {
    if (this.websocketProvider) {
      return new Promise((resolve, reject) => {
        //@ts-ignore typescript doesn't know about sendAsync
        this.websocketProvider.sendAsync(payload, (err: Error, res: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
    }
    if (!this.http) {
      const error = new Error('HTTP Connection not available');
      this.emit('error', error);
      throw error;
    }
    return this.http.send(payload);
  }

  formatResponse(payload: any, result: any) {
    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result: result,
    };
  }

  // disableSessionCreation - if true, getWalletConnector won't try to create a new session
  // in case the connector is disconnected
  getWalletConnector(
    opts: { disableSessionCreation?: boolean } = {}
  ): Promise<IConnector> {
    const { disableSessionCreation = false } = opts;
    return new Promise((resolve, reject) => {
      const wc = this.wc;
      if (this.isConnecting) {
        this.onConnect((x: any) => resolve(x));
      } else if (!wc.connected && !disableSessionCreation) {
        this.isConnecting = true;
        wc.on('modal_closed', () => {
          reject(new Error('User closed modal'));
        });
        wc.createSession({ chainId: this.chainId })
          .then(() => {
            wc.on('connect', (error, payload) => {
              if (error) {
                this.isConnecting = false;
                return reject(error);
              }
              this.isConnecting = false;
              this.connected = true;
              if (payload) {
                // Handle session update
                this.updateState(payload.params[0]);
              }
              // Emit connect event
              this.emit('connect');
              this.triggerConnect(wc);
              resolve(wc);
            });
          })
          .catch((error) => {
            this.isConnecting = false;
            reject(error);
          });
      } else {
        if (!this.connected) {
          this.connected = true;
          this.updateState(wc.session);
        }
        resolve(wc);
      }
    });
  }

  async subscribeWalletConnector() {
    const wc = await this.getWalletConnector();
    wc.on('disconnect', (error) => {
      if (error) {
        this.emit('error', error);
        return;
      }
      this.onDisconnect();
    });
    wc.on('session_update', (error, payload) => {
      if (error) {
        this.emit('error', error);
        return;
      }
      // Handle session update
      this.updateState(payload.params[0]);
    });
  }

  async onDisconnect() {
    // tslint:disable-next-line:await-promise
    await this.stop();
    this.emit('close', 1000, 'Connection closed');
    this.emit('disconnect', 1000, 'Connection disconnected');
  }

  async updateState(sessionParams: any) {
    const { accounts, chainId, networkId, rpcUrl } = sessionParams;
    // Check if accounts changed and trigger event
    if (!this.accounts || (accounts && this.accounts !== accounts)) {
      this.accounts = accounts;
      this.emit('accountsChanged', accounts);
    }
    // Check if chainId changed and trigger event
    if (!this.chainId || (chainId && this.chainId !== chainId)) {
      this.chainId = chainId;
      this.emit('chainChanged', chainId);
    }
    // Check if networkId changed and trigger event
    if (!this.networkId || (networkId && this.networkId !== networkId)) {
      this.networkId = networkId;
      this.emit('networkChanged', networkId);
    }
    // Handle rpcUrl update
    this.updateRpcUrl(this.chainId, rpcUrl || '');
  }

  updateRpcUrl(chainId: number, rpcUrl: string | undefined = '') {
    const rpc = { infuraId: this.infuraId, custom: this.rpc || undefined };
    rpcUrl = rpcUrl || getRpcUrl(chainId, rpc);
    if (rpcUrl) {
      this.rpcUrl = rpcUrl;
      this.updateHttpConnection();
    } else {
      this.emit(
        'error',
        new Error(`No RPC Url available for chainId: ${chainId}`)
      );
    }
  }

  updateHttpConnection() {
    if (this.rpcUrl) {
      this.http = new HttpConnection(this.rpcUrl);
      this.http.on('payload', (payload) => this.emit('payload', payload));
      this.http.on('error', (error) => this.emit('error', error));
    }
  }

  sendAsyncPromise(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.sendAsync(
        {
          id: payloadId(),
          jsonrpc: '2.0',
          method,
          params: params || [],
        },
        (error: any, response: any) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(response.result);
        }
      );
    });
  }

  private initialize() {
    this.updateRpcUrl(this.chainId);
    this.addProvider(
      new FixtureSubprovider({
        eth_hashrate: '0x00',
        eth_mining: false,
        eth_syncing: true,
        net_listening: true,
        web3_clientVersion: `WalletConnect/v1.x.x/javascript`,
      })
    );
    this.addProvider(new CacheSubprovider());
    this.addProvider(new SubscriptionsSubprovider());
    this.addProvider(new FilterSubprovider());
    this.addProvider(new NonceSubprovider());
    this.addProvider(new HookedWalletSubprovider(this.configWallet()));
    this.addProvider({
      handleRequest: async (payload: IJsonRpcRequest, _next: any, end: any) => {
        try {
          const { result } = await this.handleRequest(payload);
          end(undefined, result);
        } catch (error) {
          end(error);
        }
      },
      setEngine: (_: any) => _,
    });
  }

  private configWallet() {
    return {
      getAccounts: async (cb: any) => {
        try {
          const wc = await this.getWalletConnector();
          const accounts = wc.accounts;
          if (accounts && accounts.length) {
            cb(null, accounts);
          } else {
            cb(new Error('Failed to get accounts'));
          }
        } catch (error) {
          cb(error);
        }
      },
      processMessage: async (
        msgParams: { from: string; data: string },
        cb: any
      ) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.signMessage([msgParams.from, msgParams.data]);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
      processPersonalMessage: async (
        msgParams: { from: string; data: string },
        cb: any
      ) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.signPersonalMessage([
            msgParams.data,
            msgParams.from,
          ]);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
      processSignTransaction: async (txParams: any, cb: any) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.signTransaction(txParams);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
      processTransaction: async (txParams: any, cb: any) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.sendTransaction(txParams);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
      processTypedMessage: async (
        msgParams: { from: string; data: string },
        cb: any
      ) => {
        try {
          const wc = await this.getWalletConnector();
          const result = await wc.signTypedData([
            msgParams.from,
            msgParams.data,
          ]);
          cb(null, result);
        } catch (error) {
          cb(error);
        }
      },
    };
  }

  bindSocketListeners() {
    this.websocketProvider.on('close', this.onWebsocketClose.bind(this));
    this.websocketProvider.on('connect', this.onWebsocketConnect.bind(this));
  }

  async maybeReconnect() {
    setTimeout(() => {
      try {
        console.log('attempting websocket reconnection');
        if (Date.now() - this.lastReconnection < MIN_RECONNECTION_INTERVAL) {
          this.emit('websocket-disconnected');
          return;
        }
        this.lastReconnection = Date.now();
        this.websocketProvider.reset();
        this.bindSocketListeners();
        this.websocketProvider.connect();
      } catch (e) {
        this.emit('websocket-disconnected');
      }
    }, 0);
  }

  async onWebsocketConnect() {
    console.log('websocket connected', this.websocketProvider.connection.url);
    Sentry.addBreadcrumb({
      type: 'debug',
      message: 'Websocket connected',
      data: {
        url: this.websocketProvider.connection.url,
      },
      level: Sentry.Severity.Info,
    });
  }

  async onWebsocketClose(event: CloseEvent) {
    console.log('websocket closed', this.websocketProvider.connection.url);
    Sentry.addBreadcrumb({
      type: 'debug',
      message: 'Websocket connection closed',
      data: {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        url: this.websocketProvider.connection.url,
      },
      // unsure about 1001 since this could also happen due to server failure
      // but also can happen due to closing the tab normally
      // unlike other codes which will only get here after the websocket provider
      // fails to reconnect, 1000 and 1001 will get here immediately if the closing was clean
      level: [1000, 1001].includes(event.code)
        ? Sentry.Severity.Info
        : Sentry.Severity.Error,
    });
    this.maybeReconnect();
  }
}

export default WalletConnectProvider;
