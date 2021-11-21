import Web3 from 'web3';
import { getConstant, getSDK, Safe } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

const { toWei, fromWei } = Web3.utils;

export async function viewSafe(network: string, address: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let safesApi = await getSDK('Safes', web3);
  console.log(`Getting safe ${address}`);
  let safe = (await safesApi.viewSafe(address)).safe;
  console.log();
  if (!safe) {
    console.log(`The address ${address} is not a safe`);
  } else {
    displaySafe(address, safe);
  }

  console.log();
}

export async function viewSafes(
  network: string,
  address: string | undefined,
  type: Exclude<Safe['type'], 'external'> | undefined,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  address = address || undefined;

  let safesApi = await getSDK('Safes', web3);
  console.log(`Getting ${type ? type + ' ' : ''}safes...`);
  console.log();
  let safes = (await safesApi.view(address, { type })).safes.filter((safe) => safe.type !== 'external');
  if (safes.length === 0) {
    console.log('Found no safes (not counting safes external to the cardpay protocol)');
  }
  safes.forEach((safe) => {
    displaySafe(safe.address, safe);
    console.log();
  });
}

function displaySafe(address: string, safe: Safe): void {
  let { type, tokens, owners } = safe;
  console.log(`${address} -- ${type}`);
  console.log('-------------------------');
  if (safe.type === 'prepaid-card') {
    console.log(`customization DID: ${safe.customizationDID ? safe.customizationDID : ' - unset -'}`);
    console.log(`Face value: §${safe.spendFaceValue} SPEND`);
    console.log(`has been used: ${safe.hasBeenUsed}`);
    console.log(`transferrable: ${safe.transferrable}`);
  }
  if (safe.type === 'merchant' || safe.type === 'depot') {
    console.log(`info DID: ${safe.infoDID ? safe.infoDID : ' - unset -'}`);
  }
  if (safe.type === 'merchant') {
    console.log(`Accumulated SPEND value: §${safe.accumulatedSpendValue} SPEND`);
  }
  if (tokens.length === 0) {
    console.log('No tokens in safe');
  }
  tokens.forEach((item) => {
    let isIssuingToken = safe.type === 'prepaid-card' && safe.issuingToken === item.tokenAddress;
    console.log(
      `${item.token.name} - ${Web3.utils.fromWei(item.balance)} ${item.token.symbol} ${
        isIssuingToken ? '(issuing token)' : ''
      }`
    );
  });
  if (safe.type === 'prepaid-card') {
    console.log(`owner: ${safe.prepaidCardOwner}`);
  } else if (safe.type === 'merchant') {
    console.log(`merchant: ${safe.merchant}`);
  } else {
    console.log(`owner(s): ${owners.join(', ')}`);
  }
}

export async function transferTokens(
  network: string,
  safe: string,
  token: string,
  recipient: string,
  amount: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let weiAmount = toWei(amount);

  let safes = await getSDK('Safes', web3);
  let assets = await getSDK('Assets', web3);
  let { symbol } = await assets.getTokenInfo(token);

  console.log(`transferring ${amount} ${symbol} from safe ${safe} to ${recipient}`);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await safes.sendTokens(safe, token, recipient, weiAmount, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log('done');
}

export async function transferTokensGasEstimate(
  network: string,
  safe: string,
  token: string,
  recipient: string,
  amount: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let weiAmount = toWei(amount);

  let safes = await getSDK('Safes', web3);
  let assets = await getSDK('Assets', web3);
  let { symbol } = await assets.getTokenInfo(token);
  let estimate = await safes.sendTokensGasEstimate(safe, token, recipient, weiAmount);
  console.log(
    `The gas estimate for transferring ${amount} ${symbol} from safe ${safe}  to ${recipient} is ${fromWei(
      estimate
    )} ${symbol}`
  );
}

export async function setSupplierInfoDID(
  network: string,
  safe: string,
  infoDID: string,
  gasToken: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let safes = await getSDK('Safes', web3);
  let assets = await getSDK('Assets', web3);
  let { symbol } = await assets.getTokenInfo(gasToken);
  console.log(`setting the info DID for the supplier safe ${safe} to ${infoDID} using ${symbol} token to pay for gas`);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await safes.setSupplierInfoDID(safe, infoDID, gasToken, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log('done');
}
