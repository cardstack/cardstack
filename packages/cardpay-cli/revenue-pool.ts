import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { fromWei, toWei } from 'web3-utils';
import { getWeb3 } from './utils';

export async function registerMerchant(
  network: string,
  prepaidCardAddress: string,
  infoDID: string | undefined,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let revenuePool = await getSDK('RevenuePool', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(
    `Paying merchant registration fee in the amount of §${await revenuePool.merchantRegistrationFee()} SPEND from prepaid card address ${prepaidCardAddress}...`
  );
  let { merchantSafe } =
    (await revenuePool.registerMerchant(prepaidCardAddress, infoDID, (txnHash) =>
      console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`)
    )) ?? {};
  console.log(`Created merchant safe: ${merchantSafe.address}`);
}

export async function revenueBalances(network: string, merchantSafeAddress: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let revenuePool = await getSDK('RevenuePool', web3);
  let balanceInfo = await revenuePool.balances(merchantSafeAddress);
  console.log(`Merchant revenue balance for merchant safe ${merchantSafeAddress}:`);
  for (let { tokenSymbol, balance } of balanceInfo) {
    console.log(`${fromWei(balance)} ${tokenSymbol}`);
  }
}

export async function claimRevenue(
  network: string,
  merchantSafeAddress: string,
  tokenAddress: string,
  amount: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let revenuePool = await getSDK('RevenuePool', web3);
  let assets = await getSDK('Assets', web3);
  let { symbol } = await assets.getTokenInfo(tokenAddress);
  let weiAmount = toWei(amount);
  console.log(`Claiming ${amount} ${symbol} in revenue for merchant safe ${merchantSafeAddress}`);

  let blockExplorer = await getConstant('blockExplorer', web3);
  await revenuePool.claim(merchantSafeAddress, tokenAddress, weiAmount, (txnHash) =>
    console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`)
  );
  console.log('done');
}
