import { getSDK, waitForSubgraphIndex } from '@cardstack/cardpay-sdk';
import { query } from '@cardstack/cardpay-sdk/sdk/utils/graphql';

// This service makes it easier to mock the SDK in our tests
export default class CardpaySDKService {
  getSDK = getSDK;
  waitForSubgraphIndex = waitForSubgraphIndex;
  query = query;
}

declare module '@cardstack/di' {
  interface KnownServices {
    cardpay: CardpaySDKService;
  }
}
