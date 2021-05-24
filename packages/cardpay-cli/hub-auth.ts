import { getWeb3 } from './utils';
import { HubAuth } from '@cardstack/cardpay-sdk';

export const hubAuth = async (hubRootUrl: string, network: string, mnemonic: string): Promise<void> => {
  let web3 = await getWeb3(network, mnemonic);
  let authToken = await new HubAuth(web3, hubRootUrl).authenticate();
  console.log(`Authentication token: ${authToken}`);
};
