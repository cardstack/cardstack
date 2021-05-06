import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import { HttpProvider, TokenBridgeHomeSide, getConstant, networkIds } from '@cardstack/cardpay-sdk';
import { toBN } from 'web3-utils';

export default async function (
  network: string,
  mnemonic: string,
  fromBlock: number,
  recipient?: string
): Promise<void> {
  let web3 = new Web3(
    new HDWalletProvider({
      chainId: networkIds[network],
      mnemonic: {
        phrase: mnemonic,
      },
      providerOrUrl: new HttpProvider(await getConstant('rpcNode', network)),
    })
  );
  let tokenBridge = new TokenBridgeHomeSide(web3);
  recipient = recipient ?? (await web3.eth.getAccounts())[0];

  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log('Waiting for bridging to complete...');
  let result = await tokenBridge.waitForBridgingCompleted(recipient, toBN(fromBlock));
  console.log(`Bridging transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
}
