import Web3 from 'web3';
import { getWeb3 } from './utils';
import { getSDK, LayerTwoOracle } from '@cardstack/cardpay-sdk';
const { toWei, fromWei } = Web3.utils;

export async function usdPrice(network: string, token: string, amount?: string, mnemonic?: string): Promise<void> {
  amount = amount ?? '1';
  let web3 = await getWeb3(network, mnemonic);
  let amountInWei = toWei(amount);
  let layerTwoOracle = await getSDK<LayerTwoOracle>('LayerTwoOracle', web3);
  let usdPrice = await layerTwoOracle.getUSDPrice(token, amountInWei);
  console.log(`USD value: $${usdPrice.toFixed(2)} USD`);
}
export async function ethPrice(network: string, token: string, amount?: string, mnemonic?: string): Promise<void> {
  amount = amount ?? '1';
  let web3 = await getWeb3(network, mnemonic);
  let amountInWei = toWei(amount);
  let layerTwoOracle = await getSDK<LayerTwoOracle>('LayerTwoOracle', web3);
  let ethWeiPrice = await layerTwoOracle.getETHPrice(token, amountInWei);
  console.log(`ETH value: ${fromWei(ethWeiPrice)} ETH`);
}
export async function priceOracleUpdatedAt(network: string, token: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let layerTwoOracle = await getSDK<LayerTwoOracle>('LayerTwoOracle', web3);
  let date = await layerTwoOracle.getUpdatedAt(token);
  console.log(`The ${token} rate was last updated at ${date.toString()}`);
}
