import { getWeb3 } from './utils';
import { getSDK } from '@cardstack/cardpay-sdk';

export const hubAuth = async (hubRootUrl: string, network: string, mnemonic?: string): Promise<void> => {
  let web3 = await getWeb3(network, mnemonic);
  let authToken = await (await getSDK('HubAuth', web3, hubRootUrl)).authenticate();
  console.log(`Authentication token for ${hubRootUrl}: ${authToken}`);
};
