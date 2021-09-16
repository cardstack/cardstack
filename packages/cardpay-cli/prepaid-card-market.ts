import Web3 from 'web3';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

const { fromWei, toWei } = Web3.utils;

export async function getSKUInfo(network: string, sku: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);
  let assets = await getSDK('Assets', web3);
  let skuInfo = await prepaidCardMarket.getSKUInfo(sku);
  if (!skuInfo) {
    console.log(`The SKU ${sku} does not exist in the market contract`);
  } else {
    let { issuer, issuingToken, faceValue, customizationDID, askPrice } = skuInfo;
    let { symbol } = await assets.getTokenInfo(issuingToken);
    console.log(`SKU ${sku}:
  Issuer: ${issuer}
  Issuing token: ${issuingToken} (${symbol})
  Face value: §${faceValue} SPEND
  Customization DID: ${customizationDID || '-none-'}
  Ask price: ${fromWei(askPrice)} ${symbol}`);
  }
}

export async function getInventory(network: string, sku: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);
  let inventory = await prepaidCardMarket.getInventory(sku);
  console.log(`Inventory for SKU ${sku} (${inventory.length} items):
  ${inventory.map((p) => p.address).join(',\n  ')}`);
}

export async function addToInventory(
  network: string,
  fundingPrepaidCard: string,
  prepaidCardToAdd: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);

  console.log(`Adding prepaid card to inventory ${prepaidCardToAdd}...`);
  await prepaidCardMarket.addToInventory(fundingPrepaidCard, prepaidCardToAdd, undefined, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log('done');
}

export async function removeFromInventory(
  network: string,
  fundingPrepaidCard: string,
  prepaidCardAddresses: string[],
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);

  console.log(`Removing prepaid cards from inventory ${prepaidCardAddresses.join(', ')}...`);
  await prepaidCardMarket.removeFromInventory(fundingPrepaidCard, prepaidCardAddresses, undefined, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log('done');
}

export async function setAsk(
  network: string,
  prepaidCardAddress: string,
  sku: string,
  askPrice: number,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);
  let assets = await getSDK('Assets', web3);
  let skuInfo = await prepaidCardMarket.getSKUInfo(sku);
  if (!skuInfo) {
    console.log(`The SKU ${sku} does not exist in the market contract`);
  } else {
    let { issuingToken } = skuInfo;
    let { symbol } = await assets.getTokenInfo(issuingToken);
    console.log(`Setting ask price for SKU ${sku} to ${askPrice} ${symbol}...`);
    await prepaidCardMarket.setAsk(prepaidCardAddress, sku, toWei(askPrice.toString()), undefined, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log('done');
  }
}
