import config from 'config';
import { gqlQuery } from '@cardstack/cardpay-sdk';

interface Web3Config {
  network: string;
}

export interface SKUInventory {
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
}

export interface InventorySubgraph {
  data: {
    skuinventories: SKUInventory[];
  };
}

const { network } = config.get('web3') as Web3Config;

export default class Subgraph {
  // we take an array of already provisioned prepaid cards that the server know
  // about so that we can deal with a subgraph that is not in sync with the
  // latest block.
  async getInventory(provisionedPrepaidCards: string[] = []) {
    return (await gqlQuery(
      network,
      `
      {
        skuinventories(where: {askPrice_gt: 0}) {
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
          prepaidCards${
            provisionedPrepaidCards.length > 0
              ? '(where: { prepaidCardId_not_in: ' + JSON.stringify(provisionedPrepaidCards) + ' })'
              : ''
          } {
            prepaidCardId
          }
        }
      }
    `
    )) as InventorySubgraph;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    subgraph: Subgraph;
  }
}
