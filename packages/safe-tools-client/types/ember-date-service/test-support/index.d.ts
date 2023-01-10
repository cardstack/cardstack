import Service from '@ember/service';

export interface FakeDateService extends Service {
  now(): number;
  setNow(now: number): void;
  reset(): void;
}

export function setupFakeDateService(hooks: any): void;
