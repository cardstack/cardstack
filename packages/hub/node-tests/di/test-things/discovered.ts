export default class DiscoveredTestThing {
  iWasDiscovered = true;
}

declare module '@cardstack/hub/node-tests/di/dependency-injection-test' {
  interface KnownTestThings {
    discovered: DiscoveredTestThing;
  }
}
