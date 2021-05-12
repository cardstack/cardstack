import Web3 from 'web3';
import { Safes } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

export default async function (network: string, mnemonic: string, address?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);

  let safes = new Safes(web3);
  console.log('Getting safes');
  let safeDetails = await safes.view(address);
  console.log('\n\n');
  safeDetails.forEach((detail) => {
    let { address, isPrepaidCard, tokens } = detail;
    console.log(`${address} -- ${isPrepaidCard ? 'prepaid card' : 'depot'}`);
    console.log('-------------------------');
    if (detail.isPrepaidCard) {
      console.log(`Face value: §${detail.spendFaceValue} SPEND`);
    }
    tokens.forEach((item) => {
      let isIssuingToken = detail.isPrepaidCard && detail.issuingToken === item.tokenAddress;
      console.log(
        `${item.token.name} - ${Web3.utils.fromWei(item.balance)} ${item.token.symbol} ${
          isIssuingToken ? '(issuing token)' : ''
        }`
      );
    });

    console.log('\n');
  });
}
