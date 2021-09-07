export default class PrepaidCardInventory {
  async getPrepaidCardInventory() {}

  async reservePrepaidCard(_userAddress: string, _prepaidCardAddress: string) {}

  async provisionPrepaidCard(_userAddress: string, _reservationId: string) {
    // TODO hook this up to the relay server to provision a prepaid card for the
    // given reservation ID. For now we are just using this in the tests to
    // assert that we can get this far.
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'prepaid-card-inventory': PrepaidCardInventory;
  }
}
