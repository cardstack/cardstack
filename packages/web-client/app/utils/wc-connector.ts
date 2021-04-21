import {
  IWalletConnectOptions,
  IPushServerOptions,
} from '@walletconnect/types';
import * as cryptoLib from '@walletconnect/iso-crypto';

import Connector from '@walletconnect/core';
import SessionStorage from '@walletconnect/core/dist/cjs/storage';

// based on https://github.com/WalletConnect/walletconnect-monorepo/blob/1d2828fe63c97e4c0a72eea0150e2f65b819152d/packages/clients/client/src/index.ts
export default class CustomStorageWalletConnect extends Connector {
  constructor(
    connectorOpts: IWalletConnectOptions,
    chainId: string | number,
    pushServerOpts?: IPushServerOptions
  ) {
    if (!chainId) {
      throw new Error(
        'chainId is required to set custom session storage for parallel connections in WalletConnect'
      );
    }
    const storage = new SessionStorage();
    storage.storageId = `wallet-connect-chain-${chainId}`;
    super({
      cryptoLib,
      connectorOpts,
      pushServerOpts,
      sessionStorage: storage,
    });
  }
}
