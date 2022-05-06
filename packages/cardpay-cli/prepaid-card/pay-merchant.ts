import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { ContractOptions } from 'web3-eth-contract';

export default {
  command: 'pay-merchant <merchantSafe> <prepaidCard> <spendAmount>',
  describe: 'Pay a merchant from a prepaid card',
  builder(yargs: Argv) {
    return yargs
      .positional('merchantSafe', {
        type: 'string',
        description: "The address of the merchant's safe who will receive the payment",
      })
      .positional('prepaidCard', {
        type: 'string',
        description: 'The address of the prepaid card that is being used to pay the merchant',
      })
      .positional('spendAmount', {
        type: 'number',
        description: 'The amount to send to the merchant in units of SPEND',
      })
      .option('from', {
        type: 'string',
        description: 'The signing EOA. Defaults to the first derived EOA of the specified mnemonic',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    console.log('args: ' + JSON.stringify(args, null, 2));
    let { network, merchantSafe, prepaidCard, spendAmount, from } = args as unknown as {
      network: string;
      merchantSafe: string;
      prepaidCard: string;
      spendAmount: number;
      from?: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let prepaidCardSdk = await getSDK('PrepaidCard', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(
      `Paying merchant safe address ${merchantSafe} the amount §${spendAmount} SPEND from prepaid card address ${prepaidCard}...`
    );
    let contractOptions = {} as ContractOptions;
    if (from) {
      contractOptions.from = from;
    }
    await prepaidCardSdk.payMerchant(
      merchantSafe,
      prepaidCard,
      spendAmount,
      {
        onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
      },
      contractOptions
    );
    console.log('done');
  },
} as CommandModule;
