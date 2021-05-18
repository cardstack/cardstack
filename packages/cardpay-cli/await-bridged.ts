import { TokenBridgeHomeSide, getConstant } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

export default async function (
  network: string,
  mnemonic: string,
  fromBlock: number,
  recipient?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let tokenBridge = new TokenBridgeHomeSide(web3);
  recipient = recipient ?? (await web3.eth.getAccounts())[0];

  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log('Waiting for bridging to complete...');
  let result = await tokenBridge.waitForBridgingCompleted(recipient, String(fromBlock));
  console.log(`Bridging transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
}
