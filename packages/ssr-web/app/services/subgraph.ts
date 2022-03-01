import Service from '@ember/service';
import { gqlQuery, viewSafe } from '@cardstack/cardpay-sdk';

export interface SubgraphServiceOptionals {
  query?: typeof gqlQuery;
  viewSafe?: typeof viewSafe;
}

/**
 * Query the subgraph to access indexed data without requiring a web3 connection.
 */
export default class Subgraph
  extends Service
  implements Required<SubgraphServiceOptionals>
{
  viewSafe = viewSafe;
  query = gqlQuery;
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    subgraph: Subgraph;
  }
}
