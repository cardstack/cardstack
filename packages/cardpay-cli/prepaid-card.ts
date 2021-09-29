import Web3 from 'web3';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

const { fromWei } = Web3.utils;

export async function priceForFaceValue(
  network: string,
  tokenAddress: string,
  spendFaceValue: number,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCard = await getSDK('PrepaidCard', web3);
  let weiAmount = await prepaidCard.priceForFaceValue(tokenAddress, spendFaceValue);
  console.log(
    `To achieve a SPEND face value of §${spendFaceValue} you must send ${fromWei(weiAmount)} units of this token`
  );
}

export async function gasFee(network: string, tokenAddress: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCard = await getSDK('PrepaidCard', web3);
  let weiAmount = await prepaidCard.gasFee(tokenAddress);
  console.log(`The gas fee for a new prepaid card in units of this token is ${fromWei(weiAmount)}`);
}

export async function getPaymentLimits(network: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCard = await getSDK('PrepaidCard', web3);
  let { min, max } = await prepaidCard.getPaymentLimits();
  console.log(`The prepaid card payments limits are:
  minimum amount §${min} SPEND
  maximum amount §${max} SPEND`);
}

export async function create(
  network: string,
  safe: string,
  faceValues: number[],
  tokenAddress: string,
  customizationDID: string | undefined,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let prepaidCard = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let assets = await getSDK('Assets', web3);
  let { symbol } = await assets.getTokenInfo(tokenAddress);

  console.log(
    `Creating prepaid card(s) with face value(s) §${faceValues.join(
      ' SPEND, §'
    )} SPEND and issuing token ${symbol} from depot ${safe}...`
  );
  let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`);
  let {
    prepaidCards: [newCard],
  } = await prepaidCard.create(safe, tokenAddress, faceValues, undefined, customizationDID, { onTxnHash });
  console.log(`created card ${newCard.address}`);
  console.log('done');
}

export async function bulkSplit(
  network: string,
  prepaidCard: string,
  faceValue: number,
  quantity: number,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let prepaidCardAPI = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let customizationDID = await prepaidCardAPI.customizationDID(prepaidCard);
  console.log(
    `Splitting prepaid card ${prepaidCard} into ${quantity} new prepaid cards with a face value §${faceValue} SPEND and customization DID ${
      customizationDID || '-none-'
    } and placing into the default market...`
  );
  let cardsLeft = quantity;
  let sku: string | undefined;
  let allCards: string[] = [];
  try {
    do {
      console.log(
        `  Progress: ${quantity - cardsLeft} of ${quantity} (${Math.round(((quantity - cardsLeft) / quantity) * 100)}%)`
      );
      let currentNumberOfCards = Math.min(cardsLeft, 10);
      let faceValues = Array(currentNumberOfCards).fill(faceValue);
      let prepaidCards;
      ({ prepaidCards, sku } = await prepaidCardAPI.split(prepaidCard, faceValues, undefined, customizationDID, {
        onTxnHash: (txnHash) => console.log(`  Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      }));
      allCards.push(...prepaidCards.map((p) => p.address));

      cardsLeft -= currentNumberOfCards;
    } while (cardsLeft > 0);
    console.log(
      `  Progress: ${quantity - cardsLeft} of ${quantity} (${Math.round(((quantity - cardsLeft) / quantity) * 100)}%)`
    );
  } catch (err) {
    console.log(`Encountered error while performing split.`);
    if (allCards.length > 0 && sku) {
      console.log(
        `Successfully created the following prepaid cards before error was encountered: ${formatPrepaidCards(allCards)}`
      );
      await inventoryInfo(web3, sku);
    } else {
      console.log(`No cards were created`);
    }
    throw err;
  }
  console.log(`
Created ${allCards.length} new prepaid cards
Balance of ${prepaidCard}: §${await prepaidCardAPI.faceValue(prepaidCard)} SPEND
`);
  await inventoryInfo(web3, sku);
}

export async function split(
  network: string,
  prepaidCard: string,
  faceValues: number[],
  customizationDID: string | undefined,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCardAPI = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  customizationDID = customizationDID ?? (await prepaidCardAPI.customizationDID(prepaidCard));
  console.log(
    `Splitting prepaid card ${prepaidCard} into face value(s) §${faceValues.join(
      ' SPEND, §'
    )} SPEND with customizationDID ${customizationDID || '-none-'} and placing into the default market...`
  );
  let { prepaidCards, sku } = await prepaidCardAPI.split(prepaidCard, faceValues, undefined, customizationDID, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });

  await inventoryInfo(web3, sku);

  console.log(`
Created cards: ${formatPrepaidCards(prepaidCards.map((p) => p.address))}

done
`);
}

export async function transfer(
  network: string,
  prepaidCard: string,
  newOwner: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let prepaidCardAPI = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(`Transferring prepaid card ${prepaidCard} to new owner ${newOwner}...`);
  await prepaidCardAPI.transfer(prepaidCard, newOwner, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log('done');
}

export async function payMerchant(
  network: string,
  merchantSafe: string,
  prepaidCardAddress: string,
  spendAmount: number,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCard = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(
    `Paying merchant safe address ${merchantSafe} the amount §${spendAmount} SPEND from prepaid card address ${prepaidCardAddress}...`
  );
  await prepaidCard.payMerchant(merchantSafe, prepaidCardAddress, spendAmount, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log('done');
}

async function inventoryInfo(web3: Web3, sku: string): Promise<void> {
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

function formatPrepaidCards(prepaidCards: string[]): string {
  return JSON.stringify(prepaidCards, null, 2).replace('"', '').replace('[', '').replace(']', '');
}
