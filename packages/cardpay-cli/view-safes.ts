import Web3 from 'web3';
import { Safes } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

export default async function (network: string, mnemonic: string, address?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let safesApi = new Safes(web3);
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
