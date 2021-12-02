import { getSDK, waitForSubgraphIndex, gqlQuery } from '@cardstack/cardpay-sdk';

// This service makes it easier to mock the SDK in our tests
export default class CardpaySDKService {
  getSDK = getSDK;
  waitForSubgraphIndex = waitForSubgraphIndex;
  gqlQuery = gqlQuery;
}

declare module '@cardstack/di' {
  interface KnownServices {
    cardpay: CardpaySDKService;
  }
}
