import BN from 'bn.js';
import yargs from 'yargs';
import HDWalletProvider from 'parity-hdwallet-provider';
import Web3 from 'web3';
import { HttpProvider, PrepaidCard, getConstant, networkIds, getAddress } from '@cardstack/cardpay-sdk';

const { toWei } = Web3.utils;

const { network, mnemonic = process.env.MNEMONIC_PHRASE, amount, safe } = yargs(process.argv.slice(2))
  .options({
    network: {
      alias: 'n',
      type: 'string',
      description: "The Layer 1 network to ruin this script in ('kovan' or 'mainnet')",
    },
    mnemonic: {
      alias: 'm',
      type: 'string',
      description: 'Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE',
    },
    amount: {
      alias: 'a',
      type: 'number',
      description: 'Amount in DAI you would like bridged',
    },
    safe: {
      alias: 's',
      type: 'string',
      description: 'Layer 2 safe address with DAI.CPXD tokens',
    },
  })
  .demandOption(['network'], `'network' must be specified.`)
  .demandOption(['amount'], `'amount' must be specified.`)
  .demandOption(['safe'], `'safe' must be specified.`)
  .help().argv;

(async () => {
  if (!mnemonic) {
    throw new Error(
      'No mnemonic is defined, either specify the mnemonic as a positional arg or pass it in using the MNEMONIC_PHRASE env var'
    );
  }
  let web3 = new Web3(
    new HDWalletProvider({
      chainId: networkIds[network],
      mnemonic: {
        phrase: mnemonic,
      },
      providerOrUrl: new HttpProvider(await getConstant('rpcNode', network)),
    })
  );

  const amountInWei = toWei(amount.toString()).toString();
  let prepaidCard = new PrepaidCard(web3);
  let daicpxd = await getAddress('daiCpxd', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);

  console.log('Creating prepaid card');
  let result = await prepaidCard.create(safe, daicpxd, [new BN(amountInWei)]);
  console.log(`Transaction hash: ${blockExplorer}/tx/${result.transactionHash}/token-transfers`);

  process.exit(0); //eslint-disable-line no-process-exit
})().catch((e) => {
  console.error(`Error: ${e}`);
  process.exit(1); //eslint-disable-line no-process-exit
});
