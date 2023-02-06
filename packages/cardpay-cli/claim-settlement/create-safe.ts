import { Argv } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'create-safe',
  describe: 'Create a new safe with SP module and meta guard installed',
  builder(yargs: Argv) {
    return yargs
      .option('txnHash', {
        type: 'string',
        description: 'The hash of multi send safe creation transaction',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network } = args as unknown as {
      network: string;
      txnHash: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let ClaimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    // let blockExplorer = await getConstant('blockExplorer', ethersProvider);
    const o = ClaimSettlementModule.name;
    console.log(o);

    // console.log(`Create a new safe and install SP module and meta guard...`);
    // let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    // let { safeAddress, scheduledPaymentModuleAddress, metaGuardAddress } =
    //   await scheduledPaymentModule.createSafeWithModuleAndGuard(txnHash, { onTxnHash });
    // if (!safeAddress) {
    //   console.log(`Failed to deploy new safe`);
    // } else {
    //   console.log(`Safe deployed to: ${safeAddress}`);
    //   console.log(`Scheduled payment module deployed to: ${scheduledPaymentModuleAddress}`);
    //   console.log(`Meta guard deployed to: ${metaGuardAddress}`);
    // }
  },
} as CommandModule;
