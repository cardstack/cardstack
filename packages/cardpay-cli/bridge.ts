import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import BN from 'bn.js';
import { HttpProvider, TokenBridge, getConstant, networkIds, getAddress } from '@cardstack/cardpay-sdk';

const { toWei } = Web3.utils;

export default async function (
  network: string,
  mnemonic: string,
  amount: number,
  tokenAddress?: string
): Promise<void> {
  const amountInWei = toWei(amount.toString()).toString();

  let web3 = new Web3(
    new HDWalletProvider({
      chainId: networkIds[network],
      mnemonic: {
        phrase: mnemonic,
      },
      providerOrUrl: new HttpProvider(await getConstant('rpcNode', network)),
    })
  );
  let tokenBridge = new TokenBridge(web3);
  tokenAddress = tokenAddress ?? (await getAddress('daiToken', web3));
  let blockExplorer = await getConstant('blockExplorer', web3);

  {
    console.log('Sending approve transaction request');
    let result = await tokenBridge.unlockTokens(tokenAddress, new BN(amountInWei));
    console.log(`Approve transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  }

  {
    console.log('Sending relay tokens transaction request');
    let result = await tokenBridge.relayTokens(tokenAddress, new BN(amountInWei));
    console.log(`Relay tokens transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  }
}
