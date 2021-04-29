import yargs from 'yargs';
import Web3 from 'web3';
import HDWalletProvider from 'parity-hdwallet-provider';
import { HttpProvider, Safes, getConstant, networkIds } from '@cardstack/cardpay-sdk';

const { network, mnemonic = process.env.MNEMONIC_PHRASE } = yargs(process.argv.slice(2))
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
  })
  .demandOption(['network'], `'network' must be specified.`)
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

  let safes = new Safes(web3);
  console.log('Getting safes');
  let safeDetails = await safes.view();
  console.log('\n\n');
  safeDetails.forEach(({ address, isPrepaidCard, tokens }) => {
    console.log(`${address} -- ${isPrepaidCard ? 'prepaid card' : 'depot'}`);
    console.log('-------------------------');

    tokens.forEach((item: any) => {
      console.log(`${item.token.name} - ${Web3.utils.fromWei(item.balance)} ${item.token.symbol}`);
    });

    console.log('\n');
  });

  process.exit(0); //eslint-disable-line no-process-exit
})().catch((e) => {
  console.error(`Error: ${e}`);
  process.exit(1); //eslint-disable-line no-process-exit
});
