/*global fetch */
import { getSDK } from '@cardstack/cardpay-sdk';
import * as JSONAPI from 'jsonapi-typescript';
import Web3 from 'web3';

export async function getInventoriesFromAPI(web3: Web3, environment: string): Promise<JSONAPI.ResourceObject[]> {
  if (environment !== 'production' && environment !== 'staging') {
    throw new Error(`Environment must be either 'production' or 'staging'`);
  }
  let hubRootURL = environment === 'production' ? 'https://hub.cardstack.com' : 'https://hub-staging.stack.cards';
  let authToken = await (await getSDK('HubAuth', web3, hubRootURL)).authenticate();
  let response = await fetch(`${hubRootURL}/api/inventories`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/vnd.api+json',
    },
  });
  if (!response.ok) {
    let errMsg = await response.json();
    throw new Error(
      `Failed to fetch inventories from ${hubRootURL}, HTTP status ${response.status} ${JSON.stringify(errMsg)}`
    );
  }
  let jsonApiDoc = (await response.json()) as JSONAPI.CollectionResourceDoc;
  return jsonApiDoc.data;
}
