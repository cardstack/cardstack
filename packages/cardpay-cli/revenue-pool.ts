import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { fromWei } from 'web3-utils';
import { getWeb3 } from './utils';

export async function registerMerchant(network: string, mnemonic: string, prepaidCardAddress: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let revenuePool = await getSDK('RevenuePool', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(
    `Paying merchant registration fee in the amount of §${await revenuePool.merchantRegistrationFee()} SPEND from prepaid card address ${prepaidCardAddress}...`
  );
  let { merchantSafe, gnosisTxn } = await revenuePool.registerMerchant(prepaidCardAddress);
  console.log(`Created merchant safe: ${merchantSafe}`);
  console.log(`Transaction hash: ${blockExplorer}/tx/${gnosisTxn.ethereumTx.txHash}/token-transfers`);
}

export async function revenueBalances(network: string, mnemonic: string, merchantSafeAddress: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let revenuePool = await getSDK('RevenuePool', web3);
  let balanceInfo = await revenuePool.balances(merchantSafeAddress);
  console.log(`Merchant revenue balance for merchant safe ${merchantSafeAddress}:`);
  for (let { tokenSymbol, balance } of balanceInfo) {
    console.log(`${fromWei(balance)} ${tokenSymbol}`);
  }
}
