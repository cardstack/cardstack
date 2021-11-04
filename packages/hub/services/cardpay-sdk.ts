import { getSDK } from '@cardstack/cardpay-sdk';
import { MapReturnType, SDK } from '@cardstack/cardpay-sdk/sdk/version-resolver';

// This service makes it easier to mock the SDK in our tests
export default class CardpaySDKService {
  getSDK<T extends SDK>(sdk: T, ...args: any[]): Promise<MapReturnType<T>> {
    return getSDK(sdk, ...args);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    cardpay: CardpaySDKService;
  }
}
