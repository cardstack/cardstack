import { RealmConfig } from '@cardstack/core/src/interfaces';
import { join } from 'path';

export const BASE_REALM_CONFIG = {
  url: 'https://cardstack.com/base/',
  directory: join(__dirname, '..', '..', 'base-cards'),
};

export const DEMO_REALM_CONFIG = {
  url: 'https://demo.com/',
  directory: join(__dirname, '..', '..', 'demo-cards'),
};

export default class RealmsConfig {
  realms: RealmConfig[] = [
    Object.assign({ watch: true }, BASE_REALM_CONFIG),
    Object.assign({ watch: true }, DEMO_REALM_CONFIG),
  ];
}

declare module '@cardstack/hub/services' {
  interface HubServices {
    realmsConfig: RealmsConfig;
  }
}
