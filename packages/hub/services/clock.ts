export class Clock {
  hrNow() {
    return process.hrtime.bigint();
  }
  now() {
    return Date.now();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    clock: Clock;
  }
}
