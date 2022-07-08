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
  postgresTimestampNow() {
    return format(this.now(), 'yyyy-MM-dd HH:mm');
  }
}

declare module '@cardstack/hub/services' {
  interface HubServices {
    clock: Clock;
  }
}
