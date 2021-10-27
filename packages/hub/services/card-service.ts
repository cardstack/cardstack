import { CardQuery } from '@cardstack/core/src/interfaces';
import { inject } from '@cardstack/di';

export default class CardService {
  db = inject('database-manager', { as: 'db' });
  // builder = inject('card-builder', { as: 'builder' });

  query(_query: CardQuery) {
    // Query to sql
    throw new Error('Method not implemented.');
  }

  teardown() {}
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-service': CardService;
  }
}
