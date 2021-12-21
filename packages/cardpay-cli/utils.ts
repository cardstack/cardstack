import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import { AbstractProvider } from 'web3-core';
import { HttpProvider, getConstant, networkIds, getConstantByNetwork } from '@cardstack/cardpay-sdk';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { Proof, RewardTokenBalance } from '@cardstack/cardpay-sdk';

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
        // we can't use OpenEthereum nodes as it was issues with modern web3
        // providers (specifically the xdai archive node that POA hosts falls
        // into this category)
        [networkIds[network]]: getConstantByNetwork('rpcNode', network),
      },
      bridge: BRIDGE,
    });
    await provider.enable();
    return new Web3(provider as unknown as AbstractProvider);
  }
}
