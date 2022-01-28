import { Argv } from 'yargs';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import Web3 from 'web3';
const { fromWei } = Web3.utils;
import { gqlQuery } from '@cardstack/cardpay-sdk';
import { getInventoriesFromAPI } from './utils';

interface InventorySubgraph {
  data: {
    skuinventories: {
      askPrice: string; // in terms of the issuing token (wei)
      sku: {
        id: string;
        faceValue: string; // saved in the subgraph as a BigInt, but this is actually a safe js integer
        customizationDID: string;
        issuer: { id: string };
        issuingToken: {
          id: string;
          symbol: string;
        };
      };
      prepaidCards: {
        prepaidCardId: string;
      }[];
    }[];
  };
}

// TODO once the environments become aligned with the network, we can remove the
// environment parameter
export default {
  command: 'inventories <environment>',
  describe: 'Get all the inventories available in the market contract',
  builder(yargs: Argv) {
    return yargs.positional('environment', {
      type: 'string',
      choices: ['staging', 'production'],
      description: 'The environment to query',
    });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, environment } = args as unknown as {
      network: string;
      environment: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let query = `
  {
    skuinventories {
      askPrice
      sku {
        id
        customizationDID
        faceValue
        issuer {
          id
        }
        issuingToken {
          id
          symbol
        }
      }
      prepaidCards {
        prepaidCardId
      }
    }
  }
  `;
    let rawInventories = (await gqlQuery(network, query)) as InventorySubgraph;
    let inventories = await getInventoriesFromAPI(web3, environment);

    let inventoryOutput = '';
    for (let rawInventory of rawInventories.data.skuinventories) {
      let sku = rawInventory.sku.id;
      let inventorySize = rawInventory.prepaidCards.length;
      let inventory = inventories.find((inventory) => inventory.id === sku);
      let availableInventory = (inventory?.attributes?.quantity ?? 0) as number;
      inventoryOutput += `
SKU ${sku}
======================================================================`;
      inventoryOutput += `
  Issuer: ${rawInventory.sku.issuer.id}
  Issuing token: ${rawInventory.sku.issuingToken.id} (${rawInventory.sku.issuingToken.symbol})
  Face value: §${rawInventory.sku.faceValue} SPEND
  Customization DID: ${rawInventory.sku.customizationDID || '-none-'}
  Ask price: ${fromWei(rawInventory.askPrice)} ${rawInventory.sku.issuingToken.symbol}
  Inventory size: ${inventorySize}
`;
      if (!inventory && rawInventory.askPrice === '0') {
        inventoryOutput += `  ** WARNING: This item is not available--ask price is not set **
`;
      } else {
        inventoryOutput += `  Inventory reserved ${inventorySize - availableInventory}
  Inventory available: ${availableInventory}
`;
      }
    }

    console.log(inventoryOutput);
  },
} as CommandModule;
