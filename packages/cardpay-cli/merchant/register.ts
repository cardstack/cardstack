import { Argv } from 'yargs';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'register <fundingCard> <infoDID>',
  describe: 'Register as a new merchant by paying a merchant registration fee',
  builder(yargs: Argv) {
    return yargs
      .positional('fundingCard', {
        type: 'string',
        description: 'The address of the prepaid card that is being used to pay the merchant registration fee',
      })
      .positional('infoDID', {
        type: 'string',
        description: "The DID string that can be resolved to a DID document representing the merchant's information",
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, fundingCard, infoDID, trezor } = args as unknown as {
      network: string;
      fundingCard: string;
      infoDID: string;
      mnemonic?: string;
      trezor?: boolean;
    };
    let web3 = await getWeb3(network, mnemonic, trezor);
    let revenuePool = await getSDK('RevenuePool', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(
      `Paying merchant registration fee in the amount of §${await revenuePool.merchantRegistrationFee()} SPEND from prepaid card address ${fundingCard}...`
    );
    let { merchantSafe } =
      (await revenuePool.registerMerchant(fundingCard, infoDID, {
        onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      })) ?? {};
    console.log(`Created merchant safe: ${merchantSafe.address}`);
  },
} as CommandModule;
