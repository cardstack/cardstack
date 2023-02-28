import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'sign <moduleAddress> <payeeAddress> <tokenAddress> <amountInEth> [validitySeconds]',
  describe: 'Sign claim',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .positional('payeeAddress', {
        type: 'string',
        description: 'The address receiving assets from claim',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of token being claimed',
      })
      .positional('amountInEth', {
        type: 'string',
        description: 'The amount of token being claimed',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, moduleAddress, payeeAddress, tokenAddress, amountInEth } = args as unknown as {
      network: string;
      moduleAddress: string;
      payeeAddress: string;
      tokenAddress: string;
      amountInEth: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let claim = await claimSettlementModule.stakingClaim(moduleAddress, payeeAddress, tokenAddress, amountInEth);
    let { signature, encoded } = await claimSettlementModule.sign(claim);
    console.log(`encoded data: ${encoded}`);
    console.log(`signature: ${signature}`);
  },
} as CommandModule;
