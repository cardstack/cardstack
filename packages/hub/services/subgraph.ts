import config from 'config';
import { gqlQuery } from '@cardstack/cardpay-sdk';

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
export interface ProvisionedPrepaidCardSubgraph {
  data: {
    prepaidCardProvisionedEvents: {
      prepaidCard: {
        id: string;
      };
    }[];
  };
}

const network = config.get('web3.layer2Network') as string;
const POLL_INTERVAL = 1000;
const TIMEOUT = 1000 * 60 * 5;

const provisionedPrepaidCardQuery = `
  query ($txnHash: String!) {
    prepaidCardProvisionedEvents(where: { txnHash: $txnHash }) {
      prepaidCard {
        id
      }
    }
  }
`;

export interface MetaSubgraph {
  data: {
    _meta: {
      hasIndexingErrors: boolean;
      block: {
        number: number;
      };
    };
  };
}

const metaQuery = `
  query {
    _meta {
      hasIndexingErrors
      block {
        number
      }
    }
  }
`;

export interface RewardRoot {
  id: string;
  blockNumber: string;
  rootHash: string;
  paymentCycle: string;
  rewardProgram: {
    id: string;
  };
}

export interface RewardRoots {
  data: {
    merkleRootSubmissions: RewardRoot[];
  };
}
export interface RewardPrograms {
  data: {
    rewardPrograms: {
      id: string;
    }[];
  };
}

export default class Subgraph {
  // we use the subgraph to wait for the prepaid card provisioning to be mined
  // so that the SDK safe API results are consistent with the new prepaid card
  async waitForProvisionedPrepaidCard(txnHash: string): Promise<string> {
    let start = Date.now();
    let queryResults: ProvisionedPrepaidCardSubgraph | undefined;
    let prepaidCardAddress: string | undefined;
    do {
      if (queryResults) {
        await new Promise<void>((res) => setTimeout(() => res(), POLL_INTERVAL));
      }
      queryResults = await gqlQuery(network, provisionedPrepaidCardQuery, { txnHash });
      if (queryResults.data.prepaidCardProvisionedEvents.length > 0) {
        prepaidCardAddress = queryResults.data.prepaidCardProvisionedEvents[0].prepaidCard.id;
      }
    } while (!prepaidCardAddress && Date.now() < start + TIMEOUT);

    if (!prepaidCardAddress) {
      throw new Error(`Timed out waiting for prepaid card to be provisioned with txnHash ${txnHash}`);
    }

    return prepaidCardAddress;
  }

  // we take an array of already provisioned prepaid cards that the server know
  // about so that we can deal with a subgraph that is not in sync with the
  // latest block.
  async getInventory(provisionedPrepaidCards: string[] = [], issuer?: string | undefined) {
    let where = `where: {askPrice_gt: 0}`;
    if (issuer) {
      where = `where: {askPrice_gt: 0, issuer: "${issuer}"}`;
    }
    return (await gqlQuery(
      network,
      `
      {
        skuinventories(${where}) {
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

  async getRewardRoots(rewardProgramId: string, lastIndexedBlockNumber: number, limit = 100) {
    // this will query up till limits of subgraph which is 100 roots at a time
    const where = `where: {
      rewardProgram: "${rewardProgramId}",
      paymentCycle_gt: ${lastIndexedBlockNumber}
    }`;
    return (await gqlQuery(
      network,
      `
        {
            merkleRootSubmissions(
                ${where},
                orderBy: paymentCycle,
                orderDirection: asc,
                rootHash_not: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                first: ${limit}
            ){
                id
                blockNumber
                rootHash
                paymentCycle
                rewardProgram {
                    id
                }
            }
        }
    `
    )) as RewardRoots;
  }

  async getRewardPrograms(archivedRewardPrograms = []) {
    const query = `
    {
      rewardPrograms(
        where: {
          ${archivedRewardPrograms.length > 0 ? 'id_not_in:' + JSON.stringify(archivedRewardPrograms) : ''}
        })
      {
          id
      }
    }
    `;
    return (await gqlQuery(network, query)) as RewardPrograms;
  }

  async getMeta() {
    return (await gqlQuery(network, metaQuery)) as MetaSubgraph;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    subgraph: Subgraph;
  }
}
