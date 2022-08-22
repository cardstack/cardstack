import { format } from 'date-fns';
import config from 'config';

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

  // FIXME remove
  config() {
    return config;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    clock: Clock;
  }
}
