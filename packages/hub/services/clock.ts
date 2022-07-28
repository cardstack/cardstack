import { format } from 'date-fns';

export class Clock {
  hrNow() {
    return process.hrtime.bigint();
  }
  now() {
    return Date.now();
  }
  dateStringNow() {
    return format(this.now(), 'yyyy-MM-dd');
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    clock: Clock;
  }
}
