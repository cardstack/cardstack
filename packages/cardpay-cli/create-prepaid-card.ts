import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import { HttpProvider, PrepaidCard, getConstant, networkIds, getAddress } from '@cardstack/cardpay-sdk';

const { toWei } = Web3.utils;

export default async function (
  network: string,
  mnemonic: string,
  safe: string,
  amounts: number[],
  tokenAddress?: string
): Promise<void> {
  let web3 = new Web3(
    new HDWalletProvider({
      chainId: networkIds[network],
      mnemonic: {
        phrase: mnemonic,
      },
      providerOrUrl: new HttpProvider(await getConstant('rpcNode', network)),
    })
  );
  tokenAddress = tokenAddress ?? (await getAddress('daiCpxd', web3));

  const amountsInWei = amounts.map((amount) => toWei(amount.toString()).toString());
  let prepaidCard = new PrepaidCard(web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log('Creating prepaid card');
  let result = await prepaidCard.create(safe, tokenAddress, amountsInWei);
  console.log(`Transaction hash: ${blockExplorer}/tx/${result.transactionHash}/token-transfers`);
}
