import { inject } from '@cardstack/di';
import { SKUInventory } from './subgraph';
import * as JSONAPI from 'jsonapi-typescript';
import { getSDK } from '@cardstack/cardpay-sdk';
import Logger from '@cardstack/logger';

let log = Logger('routes/utils:inventory');

const expirationMins = 60;
const subgraphSyncGraceMins = 60;

interface SKUReservations {
  [sku: string]: number;
}

export default class InventoryService {
  subgraph = inject('subgraph');
  web3 = inject('web3-http', { as: 'web3' });
  relay = inject('relay');
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  async getSKUSummaries(issuer?: string): Promise<JSONAPI.ResourceObject[]> {
    let { inventories, reservations } = await this.getInventoriesAndActiveReservations(issuer);
    let prepaidCardMarket = await getSDK('PrepaidCardMarket', this.web3.getInstance());
    let [isPaused, relayIsAvailable, rpcIsAvailable] = await Promise.all([
      prepaidCardMarket.isPaused(),
      this.relay.isAvailable(),
      this.web3.isAvailable(),
    ]);
    if (!relayIsAvailable) {
      log.error(`Relay server is not available, suppressing inventory results`);
    }
    if (!rpcIsAvailable) {
      log.error(`RPC node is not available, suppressing inventory results`);
    }
    let inventoryNotAvailableOverride = isPaused || !rpcIsAvailable || !relayIsAvailable;
    let data = inventories.map((inventory) => formatInventory(inventory, reservations, inventoryNotAvailableOverride));
    return data;
  }

  async getInventoriesAndActiveReservations(
    issuer?: string
  ): Promise<{ inventories: SKUInventory[]; reservations: SKUReservations }> {
    let db = await this.databaseManager.getClient();
    let provisionResult = await db.query(
      `SELECT prepaid_card_address FROM reservations WHERE prepaid_card_address IS NOT NULL AND updated_at > now() - interval '${subgraphSyncGraceMins} minutes'`
    );
    let reservationResult = await db.query(
      `SELECT sku, count(sku) as quantity FROM reservations WHERE prepaid_card_address IS NULL AND updated_at > now() - interval '${expirationMins} minutes' GROUP BY sku`
    );
    let recentlyProvisionedPrepaidCards = provisionResult.rows.map((row) => row.prepaid_card_address);
    let reservations: SKUReservations = {};
    for (let row of reservationResult.rows) {
      reservations[row.sku] = row.quantity;
    }

    let {
      data: { skuinventories: inventories },
    } = await this.subgraph.getInventory(recentlyProvisionedPrepaidCards, issuer);
    return { inventories, reservations };
  }
}

function formatInventory(
  inventory: SKUInventory,
  reservations: SKUReservations,
  inventoryNotAvailableOverride: boolean
): JSONAPI.ResourceObject {
  let {
    askPrice,
    sku: {
      id: sku,
      faceValue,
      customizationDID,
      issuer: { id: issuer },
      issuingToken: { id: tokenAddress, symbol },
    },
    prepaidCards,
  } = inventory;
  return {
    id: sku,
    type: 'inventories',
    attributes: {
      issuer: issuer,
      sku,
      'issuing-token-symbol': symbol,
      'issuing-token-address': tokenAddress,
      'face-value': parseInt(faceValue), // SPEND is safe to represent as a number in js
      'ask-price': askPrice,
      'customization-DID': customizationDID || null,
      quantity: inventoryNotAvailableOverride ? 0 : prepaidCards.length - (reservations[sku] ?? 0),

      // These are not yet supported in the protocol right now. when these
      // become real things we'll query the subgraph for them
      reloadable: false,
      transferrable: false,
    },
  };
}

declare module '@cardstack/di' {
  interface KnownServices {
    inventory: InventoryService;
  }
}
