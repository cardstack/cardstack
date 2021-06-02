import Web3 from 'web3';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

const { toWei } = Web3.utils;

export async function viewSafes(network: string, mnemonic: string, address?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let safesApi = await getSDK('Safes', web3);
  console.log('Getting safes...');
  console.log();
  let safes = (await safesApi.view(address)).filter((safe) => safe.type !== 'external');
  if (safes.length === 0) {
    console.log('You have no safes (not counting safes external to the cardpay protocol)');
  }
  safes.forEach((safe) => {
    let { address, type, tokens } = safe;
    console.log(`${address} -- ${type}`);
    console.log('-------------------------');
    if (safe.type === 'prepaid-card' || safe.type === 'merchant') {
      console.log(`Face value: §${safe.spendFaceValue} SPEND`);
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

    console.log();
  });
}

export async function transferTokens(
  network: string,
  mnemonic: string,
  safe: string,
  token: string,
  recipient: string,
  amount: number
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let weiAmount = toWei(String(amount));

  let safes = await getSDK('Safes', web3);
  let assets = await getSDK('Assets', web3);
  let { symbol } = await assets.getTokenInfo(token);

  console.log(`transferring ${amount} ${symbol} from safe ${safe} to ${recipient}`);
  let result = await safes.sendTokens(safe, token, recipient, weiAmount);
  let blockExplorer = await getConstant('blockExplorer', web3);
  console.log(`Transaction hash: ${blockExplorer}/tx/${result.ethereumTx.txHash}/token-transfers`);
}
