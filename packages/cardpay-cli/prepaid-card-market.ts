import Web3 from 'web3';
import { getConstant, getSDK, gqlQuery } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';
import * as JSONAPI from 'jsonapi-typescript';

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

interface InventorySubgraph {
  data: {
    skuinventories: {
      askPrice: string; // in terms of the issuing token (wei)
      sku: {
        id: string;
        faceValue: string; // saved in the subgraph as a BigInt, but this is actually a safe js integer
        customizationDID: string;
        issuer: { id: string };
        issuingToken: {
          id: string;
          symbol: string;
        };
      };
      prepaidCards: {
        prepaidCardId: string;
      }[];
    }[];
  };
}
// TODO once the environments become aligned with the network, we can remove the
// environment parameter
export async function getInventories(network: string, environment: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  if (environment !== 'production' && environment !== 'staging') {
    throw new Error(`Environment must be either 'production' or 'staging'`);
  }
  let hubRootURL = environment === 'production' ? 'https://hub.cardstack.com' : 'https://hub-staging.stack.cards';
  let authToken = await (await getSDK('HubAuth', web3, hubRootURL)).authenticate();
  let query = `
  {
    skuinventories {
      askPrice
      sku {
        id
        customizationDID
        faceValue
        issuer {
          id
        }
        issuingToken {
          id
          symbol
        }
      }
      prepaidCards {
        prepaidCardId
      }
    }
  }
  `;
  let rawInventories = (await gqlQuery(network, query)) as InventorySubgraph;
  let response = await fetch(`${hubRootURL}/api/inventories`, {
    headers: {
      Authorization: `Bearer: ${authToken}`,
      'Content-Type': 'application/vnd.api+json',
    },
  });
  if (!response.ok) {
    let errMsg = await response.json();
    throw new Error(
      `Failed to fetch inventories from ${hubRootURL}, HTTP status ${response.status} ${JSON.stringify(errMsg)}`
    );
  }
  let jsonApiDoc = (await response.json()) as JSONAPI.CollectionResourceDoc;
  let inventories = jsonApiDoc.data;

  let inventoryOutput = '';
  for (let rawInventory of rawInventories.data.skuinventories) {
    let sku = rawInventory.sku.id;
    let inventorySize = rawInventory.prepaidCards.length;
    let inventory = inventories.find((inventory) => inventory.id === sku);
    let availableInventory = (inventory?.attributes?.quantity ?? 0) as number;
    inventoryOutput += `
SKU ${sku}
======================================================================`;
    inventoryOutput += `
  Issuer: ${rawInventory.sku.issuer.id}
  Issuing token: ${rawInventory.sku.issuingToken.id} (${rawInventory.sku.issuingToken.symbol})
  Face value: §${rawInventory.sku.faceValue} SPEND
  Customization DID: ${rawInventory.sku.customizationDID || '-none-'}
  Ask price: ${fromWei(rawInventory.askPrice)} ${rawInventory.sku.issuingToken.symbol}
  Inventory size: ${inventorySize}
`;
    if (!inventory && rawInventory.askPrice === '0') {
      inventoryOutput += `  ** WARNING: This item is not available--ask price is not set **
`;
    } else {
      inventoryOutput += `  Inventory reserved ${inventorySize - availableInventory}
  Inventory available: ${availableInventory}
`;
    }
  }

  console.log(inventoryOutput);
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
