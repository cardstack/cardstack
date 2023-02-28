import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { SignedClaim } from '@cardstack/cardpay-sdk/sdk/claim-settlement-module';

export default {
  command: 'execute <moduleAddress> <encoded> <signature> [payeeSafeAddress] [gasTokenAddress]',
  describe: 'Execute a claim settlement',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .positional('encoded', {
        type: 'string',
        description: 'Encoded data of claim',
      })
      .positional('signature', {
        type: 'string',
        description: 'eip712 signature',
      })
      .option('payeeSafeAddress', {
        type: 'string',
        description: 'The address receiving assets from claim',
      })
      .option('gasTokenAddress', {
        type: 'string',
        description: 'The address of gas token',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, moduleAddress, encoded, signature, payeeSafeAddress, gasTokenAddress } = args as unknown as {
      network: string;
      moduleAddress: string;
      encoded: string;
      signature: string;
      payeeSafeAddress: string;
      gasTokenAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    let signedClaim: SignedClaim = {
      signature,
      encoded,
    };
    if (payeeSafeAddress) {
      await claimSettlementModule.executeSafe(moduleAddress, payeeSafeAddress, signedClaim, gasTokenAddress, {
        onTxnHash,
      });
    } else {
      await claimSettlementModule.executeEOA(moduleAddress, signedClaim, { onTxnHash });
    }
  },
} as CommandModule;
