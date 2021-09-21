import { Client as DBClient } from 'pg';
import SubgraphService, { SKUInventory } from '../../services/subgraph';

const expirationMins = 60;
const subgraphSyncGraceMins = 60;

interface InventoryJSONAPI {
  id: string;
  type: 'inventories';
  attributes: {
    issuer: string;
    'issuing-token-symbol': string;
    'issuing-token-address': string;
    'face-value': number;
    'ask-price': string;
    'customization-DID': string | null;
    quantity: number;
  };
}

interface SKUReservations {
  [sku: string]: number;
}

export async function getSKUSummaries(db: DBClient, subgraph: SubgraphService): Promise<InventoryJSONAPI[]> {
  let { inventories, reservations } = await getInventoriesAndReservations(db, subgraph);
  let data = inventories.map((inventory) => formatInventory(inventory, reservations));
  return data;
}

async function getInventoriesAndReservations(
  db: DBClient,
  subgraph: SubgraphService
): Promise<{ inventories: SKUInventory[]; reservations: SKUReservations }> {
  let provisionResult = await db.query(
    `SELECT prepaid_card_address FROM reservations WHERE prepaid_card_address IS NOT NULL AND updated_at > now() - interval '${subgraphSyncGraceMins} minutes'`
  );
  let reservationResult = await db.query(
    `SELECT sku, count(sku) as quantity FROM reservations WHERE prepaid_card_address IS NULL AND updated_at > now() - interval '${expirationMins} minutes' GROUP BY sku`
  );
  let provisionedPrepaidCards = provisionResult.rows.map((row) => row.prepaid_card_address);
  let reservations: SKUReservations = {};
  for (let row of reservationResult.rows) {
    reservations[row.sku] = row.quantity;
  }

  let {
    data: { skuinventories: inventories },
  } = await subgraph.getInventory(provisionedPrepaidCards);
  return { inventories, reservations };
}

function formatInventory(inventory: SKUInventory, reservations: SKUReservations): InventoryJSONAPI {
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
      'issuing-token-symbol': symbol,
      'issuing-token-address': tokenAddress,
      'face-value': parseInt(faceValue), // SPEND is safe to represent as a number in js
      'ask-price': askPrice,
      'customization-DID': customizationDID || null,
      quantity: prepaidCards.length - (reservations[sku] ?? 0),
    },
  };
}
