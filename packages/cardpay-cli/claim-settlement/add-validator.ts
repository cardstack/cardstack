import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'add-validator <moduleAddress> <avatarAddress> <validatorAddress>',
  describe: 'Add validator that is enabled to sign transaction',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .positional('avatarAddress', {
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
    let { network, avatarAddress, moduleAddress, validatorAddress } = args as unknown as {
      network: string;
      avatarAddress: string;
      moduleAddress: string;
      validatorAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);

    console.log(`Validating ${validatorAddress} on module ${moduleAddress} enabled on safe ${avatarAddress}`);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    await claimSettlementModule.addValidator(moduleAddress, avatarAddress, validatorAddress, {
      onTxnHash,
    });
  },
} as CommandModule;
