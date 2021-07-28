import Web3 from 'web3';
import { getConstant, getSDK, PrepaidCardSafe } from '@cardstack/cardpay-sdk';
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
  let onPrepaidCardCreated = (prepaidCards: PrepaidCardSafe[]) =>
    console.log(`Created new prepaid card(s): ${prepaidCards.map((p) => p.address).join(', ')}`);
  let onTxHash = (txHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txHash}/token-transfers`);
  await prepaidCard.create(safe, tokenAddress, faceValues, customizationDID, onPrepaidCardCreated, onTxHash);
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

  console.log(`Splitting prepaid card ${prepaidCard} into face value(s) §${faceValues.join(' SPEND, §')} SPEND...`);
  let result = await prepaidCardAPI.split(prepaidCard, faceValues, customizationDID, (prepaidCards) =>
    console.log(`Created new prepaid card(s): ${prepaidCards.map((p) => p.address).join(', ')}`)
  );
  console.log(`Transaction hash: ${blockExplorer}/tx/${result!.gnosisTxn.ethereumTx.txHash}/token-transfers`);
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
  let result = await prepaidCardAPI.transfer(prepaidCard, newOwner);
  console.log(`Transaction hash: ${blockExplorer}/tx/${result!.ethereumTx.txHash}/token-transfers`);
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
  let result = await prepaidCard.payMerchant(merchantSafe, prepaidCardAddress, spendAmount);
  console.log(`Transaction hash: ${blockExplorer}/tx/${result?.ethereumTx.txHash}/token-transfers`);
}
