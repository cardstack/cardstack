import { Session } from '@cardstack/core/session';
import { inject, getOwner, injectionReady } from './dependency-injection';
import { myOrigin } from './origin';
import * as J from 'json-typescript';
import { upsert, param } from './pgsearch/util';
import { Expression } from '@cardstack/core/expression';
import { CardId, canonicalURL } from '@cardstack/core/card-id';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { AddressableCard } from '@cardstack/hub';
import { Batch } from './pgsearch/pgclient';
import { CardInstantiator } from '@cardstack/core/card-instantiator';
import { UpstreamIdentity, UpstreamDocument, upstreamIdToCardId } from './document';

export default class IndexingService implements IndexingTracker {
  cards = inject('cards');
  pgclient = inject('pgclient');
  queue = inject('queue');
  operationsCount = 0;

  async ready() {
    await injectionReady(this, 'queue');
    this.queue.register('index_realm', this.indexRealm.bind(this));
  }

  // This is necessary for booting a new hub that is using a remote-repo for
  // it's meta realm. In this case the index doesn't even know about its meta
  // realm, so we need to provide the meta realm card so the index can boot
  // itself.
  async indexMetaRealm(metaRealmDocument: SingleResourceDoc) {
    let scopedService = this.cards.as(Session.INTERNAL_PRIVILEGED);
    let metaRealm = await scopedService.instantiate(metaRealmDocument);
    await this._indexRealm(metaRealm, null);
  }

  async indexRealm(args: { realmCardId: CardId; params?: unknown }) {
    let scopedService = this.cards.as(Session.INTERNAL_PRIVILEGED);
    let realmCard = await scopedService.get(args.realmCardId);
    await this._indexRealm(realmCard, args.params);
  }

  increaseOperationsCount() {
    this.operationsCount++;
  }

  private async _indexRealm(realmCard: AddressableCard, params: unknown) {
    let scopedService = this.cards.as(Session.INTERNAL_PRIVILEGED);
    let indexerFactory = await realmCard.loadFeature('indexer');
    if (!indexerFactory) {
      return;
    }

    let batch = this.pgclient.beginCardBatch(scopedService);
    let indexer = await getOwner(this).instantiate(indexerFactory, realmCard);

    let meta = await this.loadMeta(realmCard.csId);

    let io = await getOwner(this).instantiate(IndexingOperations, realmCard, batch, scopedService, this);
    let newMeta = await indexer.update(meta, io, params);
    await batch.done();
    await this.pgclient.query(
      upsert('meta', 'meta_pkey', {
        ['cs_realm']: param(realmCard.csId),
        params: param((newMeta as J.Value) || null),
      }) as Expression
    );
  }

  async loadMeta(csId: string) {
    let metaResult = await this.pgclient.query(['select params from meta where cs_realm = ', param(csId)]);
    return metaResult.rowCount ? (metaResult.rows[0].params as J.Object) : null;
  }

  async updateRealm(realm: CardId, realmSpecificParams?: J.Value): Promise<void> {
    let job = await this.queue.publish(
      'index_realm',
      {
        realmCardId: {
          csRealm: realm.csRealm,
          csOriginalRealm: realm.csOriginalRealm ?? realm.csRealm,
          csId: realm.csId,
        },
        params: realmSpecificParams ?? null,
      },
      { queueName: canonicalURL(realm) }
    );
    await job.done;
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
          {
            realmCardId: {
              csRealm: realmCard.csRealm,
              csOriginalRealm: realmCard.csOriginalRealm,
              csId: realmCard.csId,
            },
          },
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

export interface IndexerFactory<Meta = unknown, Params = unknown> {
  new (realmCard: AddressableCard): Indexer<Meta, Params>;
}

export interface Indexer<Meta = unknown, Params = unknown> {
  update(meta: Meta, ops: IndexingOperations, params: Params | null): Promise<Meta | void>;
}

export interface IndexingTracker {
  increaseOperationsCount: () => void;
}

export class IndexingOperations {
  constructor(
    private realmCard: AddressableCard,
    private batch: Batch,
    private cards: CardInstantiator,
    private indexingTracker: IndexingTracker
  ) {}

  async save(upstreamId: UpstreamIdentity, doc: UpstreamDocument) {
    let id = upstreamIdToCardId(upstreamId, this.realmCard.csId);
    let card = await this.cards.instantiate(doc.jsonapi, id);
    this.indexingTracker.increaseOperationsCount();
    return await this.batch.save(card);
  }

  async delete(upstreamId: UpstreamIdentity) {
    let id = upstreamIdToCardId(upstreamId, this.realmCard.csId);
    this.indexingTracker.increaseOperationsCount();
    return await this.batch.delete(id);
  }

  async beginReplaceAll() {
    this.batch.createGeneration(this.realmCard.csId);
  }

  async finishReplaceAll() {
    await this.batch.deleteOlderGenerations(this.realmCard.csId);
  }
}
