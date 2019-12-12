import CardstackError from './error';
import { loadIndexer, loadWriter, patch, buildValueExpression } from './scaffolding';
import { WriterFactory } from './writer';
import { PristineDocument, UpstreamDocument, UpstreamIdentity, PristineCollection } from './document';
import { SingleResourceDoc } from 'jsonapi-typescript';
import cloneDeep from 'lodash/cloneDeep';
import { CardExpression } from './pgsearch/util';
import { ResponseMeta } from './pgsearch/pgclient';
import * as J from 'json-typescript';
import { IndexerFactory } from './indexer';

export class Card {
  static async makePristineCollection(cards: CardWithId[], meta: ResponseMeta): Promise<PristineCollection> {
    let pristineDocs = await Promise.all(cards.map(card => card.asPristineDoc()));
    // TODO includeds
    return new PristineCollection({
      data: pristineDocs.map(doc => doc.jsonapi.data),
      meta: (meta as unknown) as J.Object,
    });
  }

  // Almost everyone should treat this as opaque and only valid on the current
  // hub. (The only exception is some code within the hub itself that may
  // optimize by pulling these apart.)
  get id(): string | undefined {
    if (typeof this.localId === 'string') {
      return [this.realm, this.originalRealm, this.localId].map(encodeURIComponent).join('/');
    }
    return undefined;
  }

  // This is the realm the card is stored in.
  realm: string;

  // this is the realm the card was first created in. As a card is copied to
  // other realms, `card.realm` changes but `card.originalRealm` does not.
  originalRealm: string;

  // the localId distinguishes the card within its originalRealm. In some cases
  // it may be chosen by the person creating the card. In others it may be
  // chosen by the hub.
  localId: string | undefined;

  private jsonapi: SingleResourceDoc;

  // Identity invariants:
  //
  //  - within a given originalRealm, localId is unique.
  //
  //  - [originalRealm, localId] is the globally unique *semantic* identity of a
  //    card. In other words, two Cards with the same [originalRealm, localId]
  //    are "the same card" from the user's perspective, but might be different
  //    "versions" of it, stored in different realms.
  //
  //  - within a given realm, [originalRealm, localId] is unique. That is, we
  //    only allow one version of the same card per realm.
  //
  //  - [realm, originalRealm, id] is globally unique, such that there are
  //    exactly zero or one cards that match it, across all hubs.

  constructor(jsonapi: SingleResourceDoc, realm: string) {
    this.jsonapi = jsonapi;
    this.realm = realm;
    this.originalRealm =
      typeof jsonapi.data.attributes?.['original-realm'] === 'string'
        ? jsonapi.data.attributes['original-realm']
        : realm;

    if (typeof jsonapi.data.attributes?.['local-id'] === 'string') {
      this.localId = jsonapi.data.attributes?.['local-id'];
    }
  }

  async asPristineDoc(): Promise<PristineDocument> {
    let copied = cloneDeep(this.jsonapi);
    if (!copied.data.attributes) {
      copied.data.attributes = {};
    }
    copied.data.attributes.realm = this.realm;
    copied.data.attributes['original-realm'] = this.originalRealm;
    if (this.localId) {
      copied.data.attributes['local-id'] = this.localId;
    }
    copied.data.id = this.id;
    return new PristineDocument(copied);
  }

  async asUpstreamDoc(): Promise<UpstreamDocument> {
    return new UpstreamDocument(this.jsonapi);
  }

  assertHasIds(): asserts this is CardWithId {
    cardHasIds(this);
  }

  patch(otherDoc: SingleResourceDoc): void {
    patch(this.jsonapi, otherDoc);
  }

  // This is the way that data source plugins think about card IDs. The
  // upstreamId is only unique *within* a realm.
  get upstreamId(): UpstreamIdentity | null {
    if (this.realm === this.originalRealm) {
      if (typeof this.localId === 'string') {
        return this.localId;
      } else {
        return null;
      }
    } else {
      if (typeof this.localId === 'string') {
        return { originalRealm: this.originalRealm, localId: this.localId };
      } else {
        throw new CardstackError(`A card originally from a different realm must already have a local-id`, {
          status: 400,
        });
      }
    }
  }
}

function cardHasIds(card: Card): asserts card is CardWithId {
  if (typeof card.localId !== 'string') {
    throw new CardstackError(`card missing required attribute "localId"`);
  }
}

export class CardWithId extends Card {
  id!: string;
  localId!: string;
  generation?: number;

  constructor(jsonapi: SingleResourceDoc) {
    if (typeof jsonapi.data.attributes?.realm !== 'string') {
      throw new CardstackError(`card missing required attribute "realm": ${JSON.stringify(jsonapi)}`);
    }
    let realm = jsonapi.data.attributes.realm;
    super(jsonapi, realm);
    cardHasIds(this);
  }

  async loadFeature(featureName: 'writer'): Promise<WriterFactory | null>;
  async loadFeature(featureName: 'indexer'): Promise<IndexerFactory | null>;
  async loadFeature(featureName: 'buildValueExpression'): Promise<(expression: CardExpression) => CardExpression>;
  async loadFeature(featureName: any): Promise<any> {
    switch (featureName) {
      case 'writer':
        return await loadWriter(this);
      case 'indexer':
        return await loadIndexer(this);
      case 'buildValueExpression':
        return buildValueExpression;
      default:
        throw new Error(`unimplemented loadFeature("${featureName}")`);
    }
  }
}

export interface CardId {
  realm: string;
  originalRealm?: string; // if not set, its implied that its equal to `realm`.
  localId: string;
}
