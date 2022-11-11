import Connector from '@walletconnect/core';
import SessionStorage from '@walletconnect/core/dist/cjs/storage';
import * as cryptoLib from '@walletconnect/iso-crypto';
import {
  IWalletConnectOptions,
  IPushServerOptions,
  IClientMeta,
} from '@walletconnect/types';

const GET_STORAGE_ID = (chainId: number) => `wallet-connect-chain-${chainId}`;

export function clearWalletConnectStorage(chainId: number) {
  window.localStorage.removeItem(GET_STORAGE_ID(chainId));
}

// based on https://github.com/WalletConnect/walletconnect-monorepo/blob/1d2828fe63c97e4c0a72eea0150e2f65b819152d/packages/clients/client/src/index.ts
export default class CustomStorageWalletConnect extends Connector {
  constructor(
    connectorOpts: IWalletConnectOptions,
    chainId: number,
    pushServerOpts?: IPushServerOptions
  ) {
    if (!chainId) {
      throw new Error(
        'chainId is required to set custom session storage for parallel connections in WalletConnect'
      );
    }
    const storage = new SessionStorage();
    storage.storageId = GET_STORAGE_ID(chainId);
    super({
      cryptoLib,
      connectorOpts,
      pushServerOpts,
      sessionStorage: storage,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  set clientMeta(_value: IClientMeta | null) {}

  get clientMeta() {
    return {
      description: '',
      url: window.location.origin,
      name: 'Cardstack',
      icons: [],
    };
  }
}
