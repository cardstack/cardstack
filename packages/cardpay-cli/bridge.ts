import Web3 from 'web3';
import { getWeb3 } from './utils';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

const { toWei } = Web3.utils;

export async function bridgeToLayer1(
  network: string,
  safeAddress: string,
  tokenAddress: string,
  receiverAddress: string,
  amount: number,
  mnemonic?: string
): Promise<void> {
  const amountInWei = toWei(amount.toString()).toString();

  let web3 = await getWeb3(network, mnemonic);
  let tokenBridge = await getSDK('TokenBridgeHomeSide', web3);
  let assets = await getSDK('Assets', web3);
  let { symbol } = await assets.getTokenInfo(tokenAddress);
  receiverAddress = receiverAddress ?? (await web3.eth.getAccounts())[0];

  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(`Bridging ${amount} ${symbol} from layer 2 safe ${safeAddress} to layer 1 account ${receiverAddress}...`);
  let result = await tokenBridge.relayTokens(safeAddress, tokenAddress, receiverAddress, amountInWei);
  console.log(`Approve transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
}

export async function bridgeToLayer2(
  network: string,
  amount: number,
  receiverAddress: string | undefined,
  tokenAddress: string,
  mnemonic?: string
): Promise<void> {
  const amountInWei = toWei(amount.toString()).toString();

  let web3 = await getWeb3(network, mnemonic);
  let tokenBridge = await getSDK('TokenBridgeForeignSide', web3);
  let assets = await getSDK('Assets', web3);
  let { symbol } = await assets.getTokenInfo(tokenAddress);
  receiverAddress = receiverAddress ?? (await web3.eth.getAccounts())[0];

  let blockExplorer = await getConstant('blockExplorer', web3);

  {
    console.log(`Sending approve transaction request for ${amount} ${symbol}`);
    let result = await tokenBridge.unlockTokens(tokenAddress, amountInWei);
    console.log(`Approve transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  }

  {
    console.log(
      `Sending relay tokens transaction request for ${amount} ${symbol} into layer 2 safe owned by ${receiverAddress}`
    );
    let result = await tokenBridge.relayTokens(tokenAddress, receiverAddress, amountInWei);
    console.log(`Relay tokens transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
  }
}
