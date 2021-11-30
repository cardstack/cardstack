import { RealmConfig } from '@cardstack/core/src/interfaces';
import { join } from 'path';

export default class RealmsConfig {
  realms: RealmConfig[] = [
    {
      url: 'https://cardstack.com/base/',
      directory: join(__dirname, '..', '..', 'base-cards'),
      watch: true,
    },
    {
      url: 'https://demo.com/',
      directory: join(__dirname, '..', '..', 'demo-cards'),
      watch: true,
    },
  ];
}

declare module '@cardstack/di' {
  interface KnownServices {
    realmsConfig: RealmsConfig;
  }
}
