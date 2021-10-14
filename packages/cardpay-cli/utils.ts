import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import { AbstractProvider } from 'web3-core';
import { HttpProvider, getConstant, networkIds, getConstantByNetwork } from '@cardstack/cardpay-sdk';
import WalletConnectProvider from '@walletconnect/web3-provider';

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
        url: 'https://app.cardstack.com',
        icons: [],
        name: 'Cardstack - Cardpay CLI',
      },
      rpc: {
        [networkIds[network]]: getConstantByNetwork('rpcNode', network),
      },
      bridge: BRIDGE,
    });
    await provider.enable();
    return new Web3(provider as unknown as AbstractProvider);
  }
}
