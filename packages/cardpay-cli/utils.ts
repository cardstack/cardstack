import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import { AbstractProvider } from 'web3-core';
import { HttpProvider, getConstant, networkIds, getConstantByNetwork } from '@cardstack/cardpay-sdk';
import WalletConnectProvider from '@walletconnect/web3-provider';
// import { IWalletConnectOptions, IPushServerOptions } from '@walletconnect/types';
// import * as cryptoLib from '@walletconnect/iso-crypto';

// import Connector from '@walletconnect/core';
// import SessionStorage from '@walletconnect/core/dist/cjs/storage';
const BRIDGE = 'https://safe-walletconnect.gnosis.io/';

export async function getWeb3(network: string, mnemonic?: string): Promise<Web3> {
  if (mnemonic) {
    return new Web3(
      new HDWalletProvider({
        chainId: networkIds[network],
        mnemonic: {
          phrase: mnemonic,
        },
        providerOrUrl: new HttpProvider(await getConstant('rpcNode', network)),
      })
    );
  } else {
    let provider = new WalletConnectProvider({
      clientMeta: {
        description: '',
        url: 'http://localhost:3000',
        icons: [],
        name: 'Cardstack',
      },
      rpc: {
        [networkIds[network]]: getConstantByNetwork('rpcNode', network),
      },
      bridge: BRIDGE,
    });
    await provider.enable();
    return new Web3((provider as unknown) as AbstractProvider);
  }
}

// Hassan: I don't think we need this, but just leaving it here in case--as the web-client does actually use this

// based on https://github.com/WalletConnect/walletconnect-monorepo/blob/1d2828fe63c97e4c0a72eea0150e2f65b819152d/packages/clients/client/src/index.ts
// class CustomStorageWalletConnect extends Connector {
//   constructor(connectorOpts: IWalletConnectOptions, chainId: string | number, pushServerOpts?: IPushServerOptions) {
//     if (!chainId) {
//       throw new Error('chainId is required to set custom session storage for parallel connections in WalletConnect');
//     }
//     const storage = new SessionStorage();
//     storage.storageId = `wallet-connect-chain-${chainId}`;
//     super({
//       cryptoLib,
//       connectorOpts,
//       pushServerOpts,
//       sessionStorage: storage,
//     });
//   }
// }
