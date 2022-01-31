/*global fetch */
import { Argv } from 'yargs';
import { getConstant, getConstantByNetwork, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getInventoriesFromAPI } from './utils';
import Web3 from 'web3';
const { toChecksumAddress } = Web3.utils;

export default {
  command: 'provision <sku> <recipient> <environment> <secret>',
  describe: 'Provision a prepaid card to an EOA',
  builder(yargs: Argv) {
    return yargs
      .positional('sku', {
        type: 'string',
        description: 'The sku of the prepaid card to provision',
      })
      .positional('recipient', {
        type: 'string',
        description: 'The address of the recipient of the prepaid card',
      })
      .positional('environment', {
        type: 'string',
        description: 'The environment in which to provision the prepaid card (staging or production)',
      })
      .positional('secret', {
        type: 'string',
        description: 'The "provisioner secret" phrase to enable provisioning',
      });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, sku, recipient, environment, provisionerSecret } = args as unknown as {
      network: string;
      sku: string;
      recipient: string;
      environment: string;
      provisionerSecret: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);
    let inventories = await getInventoriesFromAPI(web3, environment);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let inventory = inventories.find((inventory) => inventory.id === sku);
    console.log(
      `Provisioning a prepaid card from the SKU ${sku} to the EOA ${recipient} in the ${environment} environment...`
    );
    if (!inventory || inventory.attributes?.quantity === 0) {
      console.log(`The SKU ${sku} has no available inventory`);
      return;
    }

    let relayUrl = getConstantByNetwork('relayServiceURL', network);
    let response = await fetch(`${relayUrl}/v1/prepaid-card/provision/${sku}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: provisionerSecret,
      },
      body: JSON.stringify({
        owner: toChecksumAddress(recipient),
      }),
    });
    let body = await response.json();
    if (!response.ok) {
      console.log(
        `Could not provision prepaid card for customer ${recipient}, sku ${sku}, received ${
          response.status
        } from relay server: ${JSON.stringify(body)}`
      );
      return;
    }
    let { txHash } = body;
    console.log(`Transaction hash: ${blockExplorer}/tx/${txHash}/token-transfers`);
    let prepaidCard = await prepaidCardMarket.getPrepaidCardFromProvisionTxnHash(txHash);
    console.log(`Provisioned the EOA ${recipient} the prepaid card ${prepaidCard.address}`);
  },
} as CommandModule;
