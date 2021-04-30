import Web3 from 'web3';
import HDWalletProvider from 'parity-hdwallet-provider';
import { HttpProvider, Safes, getConstant, networkIds } from '@cardstack/cardpay-sdk';

export default async function (network: string, mnemonic: string, address?: string): Promise<void> {
  let web3 = new Web3(
    new HDWalletProvider({
      chainId: networkIds[network],
      mnemonic: {
        phrase: mnemonic,
      },
      providerOrUrl: new HttpProvider(await getConstant('rpcNode', network)),
    })
  );

  let safes = new Safes(web3);
  console.log('Getting safes');
  let safeDetails = await safes.view(address);
  console.log('\n\n');
  safeDetails.forEach(({ address, isPrepaidCard, tokens }) => {
    console.log(`${address} -- ${isPrepaidCard ? 'prepaid card' : 'depot'}`);
    console.log('-------------------------');

    tokens.forEach((item: any) => {
      console.log(`${item.token.name} - ${Web3.utils.fromWei(item.balance)} ${item.token.symbol}`);
    });

    console.log('\n');
  });
}
