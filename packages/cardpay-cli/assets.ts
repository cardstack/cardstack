import { getConstantByNetwork, getSDK, ERC20ABI, Assets } from '@cardstack/cardpay-sdk';
import { AbiItem } from 'web3-utils';
import { getWeb3 } from './utils';

export const viewTokenBalance = async (
  network: string,
  tokenAddress: string | undefined,
  mnemonic?: string
): Promise<void> => {
  let web3 = await getWeb3(network, mnemonic);
  let assets = await getSDK<Assets>('Assets', web3);

  if (!tokenAddress) {
    const nativeTokenSymbol = getConstantByNetwork('nativeTokenSymbol', network);

    const balance = await assets.getNativeTokenBalance();

    console.log(`${nativeTokenSymbol} balance - ${web3.utils.fromWei(balance)}`);
  } else {
    const balance = await assets.getBalanceForToken(tokenAddress);
    const tokenContract = new web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    const tokenSymbol = await tokenContract.methods.symbol().call();

    console.log(`${tokenSymbol} balance - ${web3.utils.fromWei(balance)}`);
  }
};
