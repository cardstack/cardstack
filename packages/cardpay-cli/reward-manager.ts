import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

export async function registerRewardProgram(
  network: string,
  prepaidCard: string,
  admin: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCardAPI = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  console.log(`Registering reward program`);
  await prepaidCardAPI.registerRewardProgram(prepaidCard, admin, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log('done');
}
