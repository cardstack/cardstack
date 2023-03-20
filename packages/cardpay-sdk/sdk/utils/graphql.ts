/*global fetch */

import Web3 from 'web3';
import { getConstant } from '../constants';

/**
 * @group Utils
 */
export async function query(
  network: string,
  graphQLQuery: string,
  variables?: { [varName: string]: string | number | null }
): Promise<{ data: any }>;
export async function query(
  web3: Web3,
  graphQLQuery: string,
  variables?: { [varName: string]: string | number | null }
): Promise<{ data: any }>;
export async function query(
  networkOrWeb3: string | Web3,
  graphQLQuery: string,
  variables?: { [varName: string]: string | number | null }
): Promise<{ data: any }> {
  const subgraphURL = await getConstant('subgraphURL', networkOrWeb3);

  if (!subgraphURL) {
    throw `No subgraphURL for ${networkOrWeb3}`;
  }

  let response = await fetch(subgraphURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: graphQLQuery,
      variables,
    }),
  });

  let result = await response.json();

  if (result.errors) {
    let e = new Error('GraphQL query to subgraph failed');
    // @ts-ignore
    e.detail = result.errors;
    throw e;
  } else {
    return result;
  }
}
