import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import { HttpProvider, getConstant, networkIds } from '@cardstack/cardpay-sdk';

export async function getWeb3(network: string, mnemonic: string): Promise<Web3> {
  return new Web3(
    new HDWalletProvider({
      chainId: networkIds[network],
      mnemonic: {
        phrase: mnemonic,
      },
      providerOrUrl: new HttpProvider(await getConstant('rpcNode', network)),
    })
  );
}
