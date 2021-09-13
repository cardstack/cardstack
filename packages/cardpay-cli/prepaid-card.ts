import Web3 from 'web3';
import { Assets, getConstant, getSDK, PrepaidCard } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

const { fromWei } = Web3.utils;

export async function priceForFaceValue(
  network: string,
  tokenAddress: string,
  spendFaceValue: number,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCard = await getSDK<PrepaidCard>('PrepaidCard', web3);
  let weiAmount = await prepaidCard.priceForFaceValue(tokenAddress, spendFaceValue);
  console.log(
    `To achieve a SPEND face value of §${spendFaceValue} you must send ${fromWei(weiAmount)} units of this token`
  );
}

export async function gasFee(network: string, tokenAddress: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCard = await getSDK<PrepaidCard>('PrepaidCard', web3);
  let weiAmount = await prepaidCard.gasFee(tokenAddress);
  console.log(`The gas fee for a new prepaid card in units of this token is ${fromWei(weiAmount)}`);
}

export async function getPaymentLimits(network: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCard = await getSDK<PrepaidCard>('PrepaidCard', web3);
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

  let prepaidCard = await getSDK<PrepaidCard>('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let assets = await getSDK<Assets>('Assets', web3);
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

export async function split(
  network: string,
  prepaidCard: string,
  faceValues: number[],
  customizationDID: string | undefined,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let prepaidCardAPI = await getSDK<PrepaidCard>('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(
    `Splitting prepaid card ${prepaidCard} into face value(s) §${faceValues.join(
      ' SPEND, §'
    )} SPEND and placing into the default market...`
  );
  let { prepaidCards } = await prepaidCardAPI.split(prepaidCard, faceValues, undefined, customizationDID, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`created cards: ${prepaidCards.map((p) => p.address).join(', ')}`);
  console.log('done');
}

export async function transfer(
  network: string,
  prepaidCard: string,
  newOwner: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let prepaidCardAPI = await getSDK<PrepaidCard>('PrepaidCard', web3);
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
  let prepaidCard = await getSDK<PrepaidCard>('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(
    `Paying merchant safe address ${merchantSafe} the amount §${spendAmount} SPEND from prepaid card address ${prepaidCardAddress}...`
  );
  await prepaidCard.payMerchant(merchantSafe, prepaidCardAddress, spendAmount, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log('done');
}
