import {
  getSDK,
  waitForSubgraphIndex,
  waitForTransactionConsistency,
  gqlQuery,
  getConstantByNetwork,
  fetchSupportedGasTokens,
} from '@cardstack/cardpay-sdk';

// This service makes it easier to mock the SDK in our tests
export default class CardpaySDKService {
  getSDK = getSDK;
  waitForSubgraphIndex = waitForSubgraphIndex;
  waitForTransactionConsistency = waitForTransactionConsistency;
  gqlQuery = gqlQuery;
  getConstantByNetwork = getConstantByNetwork;
  fetchSupportedGasTokens = fetchSupportedGasTokens;
}

declare module '@cardstack/di' {
  interface KnownServices {
    cardpay: CardpaySDKService;
  }
}
