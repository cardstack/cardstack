import { fromWei, getSDK } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';

export async function inventoryInfo(web3: Web3, sku: string): Promise<void> {
  let marketAPI = await getSDK('PrepaidCardMarket', web3);
  let assets = await getSDK('Assets', web3);
  let skuInfo = await marketAPI.getSKUInfo(sku);
  if (!skuInfo) {
    console.log('Error: no sku info available');
  } else {
    let { symbol } = await assets.getTokenInfo(skuInfo.issuingToken);
    let inventory = await marketAPI.getInventory(sku);
    console.log(`SKU Info:
  SKU:               ${sku}
  Face value:        §${skuInfo.faceValue} SPEND
  Issuing token      ${symbol}
  Issuer:            ${skuInfo.issuer}
  Customization DID: ${skuInfo.customizationDID || '-none-'}
  Ask Price:         ${fromWei(skuInfo.askPrice)} ${symbol}
  Inventory size:    ${inventory.length}`);
  }
}

export function formatPrepaidCards(prepaidCards: string[]): string {
  return JSON.stringify(prepaidCards, null, 2).replace(/"/g, '').replace('[', '').replace(']', '');
}
