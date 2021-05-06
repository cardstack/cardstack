import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import { HttpProvider, TokenBridgeForeignSide, getConstant, networkIds, getAddress } from '@cardstack/cardpay-sdk';

const { toWei } = Web3.utils;

export default async function (
  network: string,
  mnemonic: string,
  amount: number,
  receiverAddress?: string,
  tokenAddress?: string
): Promise<void> {
  const amountInWei = toWei(amount.toString()).toString();

  let web3 = new Web3(
    new HDWalletProvider({
      chainId: networkIds[network],
      mnemonic: {
        phrase: mnemonic,
      },
      providerOrUrl: new HttpProvider(await getConstant('rpcNode', network)),
    })
  );
  let tokenBridge = new TokenBridgeForeignSide(web3);
  tokenAddress = tokenAddress ?? (await getAddress('daiToken', web3));
  receiverAddress = receiverAddress ?? (await web3.eth.getAccounts())[0];

  let blockExplorer = await getConstant('blockExplorer', web3);

  {
    console.log('Sending approve transaction request');
    let result = await tokenBridge.unlockTokens(tokenAddress, amountInWei);
    console.log(`Approve transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  }

  {
    console.log('Sending relay tokens transaction request');
    let result = await tokenBridge.relayTokens(tokenAddress, receiverAddress, amountInWei);
    console.log(`Relay tokens transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  }
}
