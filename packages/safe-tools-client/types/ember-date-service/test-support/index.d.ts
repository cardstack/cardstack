import Service from '@ember/service';

export interface FakeDateService extends Service {
  now(): number;
  setNow(now: number): void;
  reset(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupFakeDateService(hooks: any): void;
