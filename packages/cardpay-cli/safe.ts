import Web3 from 'web3';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

const { toWei } = Web3.utils;

export async function viewSafes(network: string, mnemonic: string, address?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let safesApi = await getSDK('Safes', web3);
  console.log('Getting safes');
  let safes = await safesApi.view(address);
  console.log('\n\n');
  safes.forEach((safe) => {
    let { address, type, tokens } = safe;
    if (type === 'external') {
      return;
    }
    console.log(`${address} -- ${type}`);
    console.log('-------------------------');
    if (safe.type === 'prepaid-card') {
      console.log(`Face value: §${safe.spendFaceValue} SPEND`);
    }
    tokens.forEach((item) => {
      let isIssuingToken = safe.type === 'prepaid-card' && safe.issuingToken === item.tokenAddress;
      console.log(
        `${item.token.name} - ${Web3.utils.fromWei(item.balance)} ${item.token.symbol} ${
          isIssuingToken ? '(issuing token)' : ''
        }`
      );
    });

    console.log('\n');
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
