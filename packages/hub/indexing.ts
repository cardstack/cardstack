import { Session } from '@cardstack/core/session';
import { inject, getOwner, injectionReady } from './dependency-injection';
import { myOrigin } from '@cardstack/core/origin';
import { IndexingOperations } from '@cardstack/core/indexer';
import * as JSON from 'json-typescript';
import { upsert, param } from './pgsearch/util';
import { Expression } from '@cardstack/core/expression';
import { CardId } from '@cardstack/core/card-id';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

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

    let meta = await this.loadMeta(realmCard.csId);

    let io = await getOwner(this).instantiate(IndexingOperations, realmCard, batch, scopedService);
    let newMeta = await indexer.update(meta, io);
    await batch.done();
    await this.pgclient.query(
      upsert('meta', 'meta_pkey', {
        ['cs_realm']: param(realmCard.csId),
        params: param(newMeta || null),
      }) as Expression
    );
  }

  async loadMeta(csId: string) {
    let metaResult = await this.pgclient.query(['select params from meta where cs_realm = ', param(csId)]);
    return metaResult.rowCount ? (metaResult.rows[0].params as JSON.Object) : null;
  }

  // For all the realms ensure that each realm has run indexing at least once
  // and then resolve this promise.
  async update(): Promise<void> {
    // Note that the default page size for search is 10. we may want to
    // explicitely set the page size here to something very high...
    let { cards: realms } = await this.cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: {
        type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'realm' },
        eq: {
          csRealm: `${myOrigin}/api/realms/meta`,
        },
      },
    });
    await Promise.all(
      realms.map(async realmCard => {
        let job = await this.queue.publish(
          'index_realm',
          { csRealm: realmCard.csRealm, csOriginalRealm: realmCard.csOriginalRealm, csId: realmCard.csId },
          { queueName: realmCard.canonicalURL }
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
