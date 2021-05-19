import { getWeb3 } from './utils';
import HubAuth from '../cardpay-sdk/sdk/hub-auth';

export const hubAuth = async (hubHost: string, network: string, mnemonic: string): Promise<void> => {
  let web3 = await getWeb3(network, mnemonic);
  let authToken = await new HubAuth(web3, hubHost).authenticate();
  console.log(`Authentication token: ${authToken}`);
};
