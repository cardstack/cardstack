import { Safe } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';

export function displaySafe(address: string, safe: Safe): void {
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
