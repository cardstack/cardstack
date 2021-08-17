import Web3 from 'web3';
import { getWeb3 } from './utils';
import { getSDK } from '@cardstack/cardpay-sdk';
const { toWei } = Web3.utils;

export async function ethToUsdPrice(network: string, ethAmount?: string, mnemonic?: string): Promise<void> {
  ethAmount = ethAmount ?? '1';
  let web3 = await getWeb3(network, mnemonic);
  let ethAmountInWei = toWei(ethAmount);
  let layerOneOracle = await getSDK('LayerOneOracle', web3);
  let usdPrice = await layerOneOracle.ethToUsd(ethAmountInWei);
  console.log(`USD value: $${usdPrice.toFixed(2)} USD`);
}
export async function priceOracleUpdatedAt(network: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let layerOneOracle = await getSDK('LayerOneOracle', web3);
  let date = await layerOneOracle.getEthToUsdUpdatedAt();
  console.log(`The ETH / USD rate was last updated at ${date.toString()}`);
}
