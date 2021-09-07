import Web3 from 'web3';
import { getWeb3 } from './utils';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

const { toWei } = Web3.utils;

export async function bridgeToLayer1(
  network: string,
  safeAddress: string,
  tokenAddress: string,
  receiverAddress: string,
  amount: string,
  mnemonic?: string
): Promise<void> {
  const amountInWei = toWei(amount);

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

export async function awaitBridgedToLayer1(
  network: string,
  fromBlock: string,
  txnHash: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let tokenBridge = await getSDK('TokenBridgeHomeSide', web3);

  console.log(`Waiting for bridge validation to complete for ${txnHash}...`);

  let { messageId, encodedData, signatures } = await tokenBridge.waitForBridgingValidation(fromBlock, txnHash);
  console.log(`Bridge validation complete:
messageId: ${messageId}
encodedData: ${encodedData}
signatures: ${signatures.join(' ')}
`);
}

export async function claimLayer1BridgedTokens(
  network: string,
  messageId: string,
  encodedData: string,
  signatures: string[],
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let tokenBridge = await getSDK('TokenBridgeForeignSide', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(`Claiming layer 1 bridge tokens for message ID ${messageId}...`);
  await tokenBridge.claimBridgedTokens(messageId, encodedData, signatures, {
    onTxnHash: (txnHash) => console.log(`transaction hash: ${blockExplorer}/tx/${txnHash}`),
  });
  console.log('Completed');
}

export async function bridgeToLayer2(
  network: string,
  amount: string,
  receiverAddress: string | undefined,
  tokenAddress: string,
  mnemonic?: string
): Promise<void> {
  const amountInWei = toWei(amount);

  let web3 = await getWeb3(network, mnemonic);
  let tokenBridge = await getSDK('TokenBridgeForeignSide', web3);
  let assets = await getSDK('Assets', web3);
  let { symbol } = await assets.getTokenInfo(tokenAddress);
  receiverAddress = receiverAddress ?? (await web3.eth.getAccounts())[0];

  let blockExplorer = await getConstant('blockExplorer', web3);

  {
    console.log(`Sending approve transaction request for ${amount} ${symbol}`);
    await tokenBridge.unlockTokens(tokenAddress, amountInWei, {
      onTxnHash: (txnHash) => console.log(`Approve transaction hash: ${blockExplorer}/tx/${txnHash}`),
    });
    console.log('completed approval');
  }

  {
    console.log(
      `Sending relay tokens transaction request for ${amount} ${symbol} into layer 2 safe owned by ${receiverAddress}`
    );
    await tokenBridge.relayTokens(tokenAddress, receiverAddress, amountInWei, {
      onTxnHash: (txnHash) => console.log(`Relay tokens transaction hash: ${blockExplorer}/tx/${txnHash}`),
    });
    console.log('completed relay');
  }
}

export async function awaitBridgedToLayer2(
  network: string,
  fromBlock: string,
  recipient: string | undefined,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let tokenBridge = await getSDK('TokenBridgeHomeSide', web3);
  recipient = recipient ?? (await web3.eth.getAccounts())[0];

  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log(`Waiting for bridging to complete for depot owner ${recipient} from block ${fromBlock}...`);
  let result = await tokenBridge.waitForBridgingToLayer2Completed(recipient, fromBlock);
  console.log(`Bridging transaction hash: ${blockExplorer}/tx/${result.transactionHash}`);
}
