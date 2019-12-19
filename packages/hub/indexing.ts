import { Session } from './session';
import { inject, getOwner, injectionReady } from './dependency-injection';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { myOrigin } from './origin';
import { IndexingOperations } from './indexer';
import * as JSON from 'json-typescript';
import { upsert, param, Expression } from './pgsearch/util';
import { CardId } from './card';

export default class IndexingService {
  cards = inject('cards');
  pgclient = inject('pgclient');
  queue = inject('queue');

  async ready() {
    await injectionReady(this, 'queue');
    this.queue.register('index_realm', this.indexRealm.bind(this));
  }

  private async indexRealm(realmCardId: CardId) {
    let scopedService = this.cards.as(Session.INTERNAL_PRIVILEGED);
    let realmCard = await scopedService.get(realmCardId);
    let indexerFactory = await realmCard.loadFeature('indexer');
    if (!indexerFactory) {
      return;
    }

    let batch = this.pgclient.beginCardBatch(scopedService);
    let indexer = await getOwner(this).instantiate(indexerFactory, realmCard);

    let metaResult = await this.pgclient.query(['select params from meta where realm = ', param(realmCard.localId)]);
    let meta = metaResult.rowCount ? (metaResult.rows[0].params as JSON.Object) : null;

    let newMeta = await indexer.update(meta, new IndexingOperations(realmCard, batch, scopedService));
    await batch.done();
    await this.pgclient.query(
      upsert('meta', 'meta_pkey', {
        realm: param(realmCard.localId),
        params: param(newMeta || null),
      }) as Expression
    );
  }

  // For all the realms ensure that each realm has run indexing at least once
  // and then resolve this promise.
  async update(): Promise<void> {
    // Note that the default page size for search is 10. we may want to
    // explicitely set the page size here to something very high...
    let { cards: realms } = await this.cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: {
        type: { realm: CARDSTACK_PUBLIC_REALM, localId: 'realm' },
        eq: {
          csRealm: `${myOrigin}/api/realms/meta`,
        },
      },
    });
    await Promise.all(
      realms.map(async realmCard => {
        let job = await this.queue.publish(
          'index_realm',
          { realm: realmCard.realm, originalRealm: realmCard.originalRealm, localId: realmCard.localId },
          { queueName: realmCard.id }
        );
        return job.done;
      })
    );
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    indexing: IndexingService;
  }
}
