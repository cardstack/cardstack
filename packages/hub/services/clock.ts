export class Clock {
  hrNow() {
    return process.hrtime.bigint();
  }
  now() {
    return Date.now();
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    clock: Clock;
  }
}
