import config from 'config';

export default class RelayService {
  async provisionPrepaidCard(_userAddress: string, _reservationId: string): Promise<string> {
    // TODO hook this up to the relay server to provision a prepaid card for the
    // given reservation ID. For now we are just using this in the tests to
    // assert that we can get this far.
    return Promise.resolve('0x0000000000000000000000000000000000000000');
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    relay: RelayService;
  }
}
