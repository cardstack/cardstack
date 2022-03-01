import Service from '@ember/service';
import { viewSafe } from '@cardstack/cardpay-sdk';

/**
 * Query the subgraph to access indexed data without requiring a web3 connection.
 */
export default class Subgraph extends Service {
  viewSafe = viewSafe;
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    subgraph: Subgraph;
  }
}
