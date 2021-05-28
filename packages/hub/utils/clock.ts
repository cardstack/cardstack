export class Clock {
  hrNow() {
    return process.hrtime.bigint();
  }
  now() {
    return Date.now();
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    clock: Clock;
  }
}
