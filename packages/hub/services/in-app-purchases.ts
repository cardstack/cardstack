export default class InAppPurchases {
  async validate(provider: string, receipt: any) {
    console.error('In-app purchase validation is not implemented, arguments are', provider, receipt);

    return { valid: true, response: {} };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'in-app-purchases': InAppPurchases;
  }
}
