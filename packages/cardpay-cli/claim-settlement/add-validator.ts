import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'add-validator <moduleAddress> <safeAddress> <validatorAddress>',
  describe: 'Enable claim settlement module on the safe',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose enables the scheduled payment module',
      })
      .positional('validatorAddress', {
        type: 'string',
        description: 'Validator address (a person who can sign for claims)',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, safeAddress, moduleAddress, validatorAddress } = args as unknown as {
      network: string;
      safeAddress: string;
      moduleAddress: string;
      validatorAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);

    console.log(`Validating ${validatorAddress} on module ${moduleAddress} enabled on safe ${safeAddress}`);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    await claimSettlementModule.addValidator(moduleAddress, safeAddress, validatorAddress, {
      onTxnHash,
    });
  },
} as CommandModule;
