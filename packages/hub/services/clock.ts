import { format } from 'date-fns';
import { nowUtc } from '../utils/dates';

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
  utcNow() {
    return nowUtc();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    clock: Clock;
  }
}
