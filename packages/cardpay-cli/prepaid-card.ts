import Web3 from 'web3';
import { PrepaidCard, getConstant, getAddress } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

const { toWei, fromWei } = Web3.utils;

export async function priceForFaceValue(
  network: string,
  mnemonic: string,
  tokenAddress: string,
  spendFaceValue: number
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCard = new PrepaidCard(web3);
  let weiAmount = await prepaidCard.priceForFaceValue(tokenAddress, spendFaceValue);
  console.log(
    `To achieve a SPEND face value of §${spendFaceValue} you must send ${fromWei(weiAmount)} units of this token`
  );
}

export async function gasFee(network: string, mnemonic: string, tokenAddress: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCard = new PrepaidCard(web3);
  let weiAmount = await prepaidCard.gasFee(tokenAddress);
  console.log(`The gas fee for a new prepaid card in units of this token is ${fromWei(weiAmount)}`);
}

export async function createPrepaidCard(
  network: string,
  mnemonic: string,
  safe: string,
  amounts: number[],
  tokenAddress?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  tokenAddress = tokenAddress ?? (await getAddress('daiCpxd', web3));

  const amountsInWei = amounts.map((amount) => toWei(amount.toString()).toString());
  let prepaidCard = new PrepaidCard(web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log('Creating prepaid card');
  let result = await prepaidCard.create(safe, tokenAddress, amountsInWei);
  console.log(`Transaction hash: ${blockExplorer}/tx/${result.transactionHash}/token-transfers`);
}
