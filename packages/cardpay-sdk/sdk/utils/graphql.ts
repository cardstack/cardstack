/*global fetch */

import Web3 from 'web3';
import { getConstant } from '../constants';

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
  let subgraphURL: string;
  if (typeof networkOrWeb3 === 'string') {
    subgraphURL = await getConstant('subgraphURL', networkOrWeb3);
  } else {
    subgraphURL = await getConstant('subgraphURL', networkOrWeb3);
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
  return await response.json();
}
