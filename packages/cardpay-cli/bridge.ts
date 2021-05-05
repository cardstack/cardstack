import Web3 from 'web3';
import { TokenBridge, getConstant, getAddress } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

const { toWei } = Web3.utils;

export default async function (
  network: string,
  mnemonic: string,
  amount: number,
  tokenAddress?: string
): Promise<void> {
  const amountInWei = toWei(amount.toString()).toString();

  let web3 = await getWeb3(network, mnemonic);
  let tokenBridge = new TokenBridge(web3);
  tokenAddress = tokenAddress ?? (await getAddress('daiToken', web3));
  let blockExplorer = await getConstant('blockExplorer', web3);

  {
    console.log('Sending approve transaction request');
    let result = await tokenBridge.unlockTokens(tokenAddress, amountInWei);
    console.log(`Approve transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  }

  {
    console.log('Sending relay tokens transaction request');
    let result = await tokenBridge.relayTokens(tokenAddress, amountInWei);
    console.log(`Relay tokens transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  }
}
