import { join } from 'path';
import FSRealm from '@cardstack/hub/realms/fs-realm';

export const BASE_CARD_REALM_CONFIG = {
  url: 'https://cardstack.com/base',
  directory: join(__dirname, '..', '..', '..', 'base-cards'),
  class: FSRealm,
};
