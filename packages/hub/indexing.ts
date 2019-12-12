import { Session } from './session';
import { inject, getOwner } from './dependency-injection';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { myOrigin } from './origin';
import { IndexingOperations } from './indexer';

export default class IndexingService {
  cards = inject('cards');
  pgclient = inject('pgclient');

  // For all the realms ensure that each realm has run indexing at least once
  // and then resolve this promise.
  async update(): Promise<void> {
    // Note that the default page size for search is 10. we may want to
    // explicitely set the page size here to something very high...
    let { cards: realms } = await this.cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: {
        type: { realm: CARDSTACK_PUBLIC_REALM, localId: 'realm' },
        eq: {
          realm: `${myOrigin}/api/realms/meta`,
        },
      },
    });

    await Promise.all(
      realms.map(async realmCard => {
        let indexerFactory = await realmCard.loadFeature('indexer');
        if (!indexerFactory) {
          return;
        }

        let scopedService = this.cards.as(Session.INTERNAL_PRIVILEGED);
        let batch = this.pgclient.beginCardBatch(scopedService);
        let indexer = await getOwner(this).instantiate(indexerFactory, realmCard);

        await indexer.update(new IndexingOperations(batch));
        await batch.done();
      })
    );
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    indexing: IndexingService;
  }
}
