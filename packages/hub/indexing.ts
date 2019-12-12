import { Session } from './session';
import { inject, getOwner } from './dependency-injection';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { myOrigin } from './origin';
import { IndexingOperations } from './indexer';
import * as JSON from 'json-typescript';
import { upsert, param, Expression } from './pgsearch/util';

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

        // TODO need to make sure that if this hub does not have a handler for
        // the realm it does not pick up this job from the queue so that some
        // other hub that knows how to index realm this can process this item
        // from the queue.
        if (!indexerFactory) {
          return;
        }

        // TODO the logic inside this map should be handled by the queing system
        let scopedService = this.cards.as(Session.INTERNAL_PRIVILEGED);
        let batch = this.pgclient.beginCardBatch(scopedService);
        let indexer = await getOwner(this).instantiate(indexerFactory, realmCard);

        let metaResult = await this.pgclient.query([
          'select params from meta where realm = ',
          param(realmCard.localId),
        ]);
        let meta = metaResult.rowCount ? (metaResult.rows[0].params as JSON.Object) : null;

        let newMeta = await indexer.update(meta, new IndexingOperations(realmCard, batch));
        await batch.done();
        await this.pgclient.query(
          upsert('meta', 'meta_pkey', {
            realm: param(realmCard.localId),
            params: param(newMeta || null),
          }) as Expression
        );
      })
    );
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    indexing: IndexingService;
  }
}
