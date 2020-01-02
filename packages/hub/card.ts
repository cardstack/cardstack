import CardstackError from './error';
import { loadIndexer, loadWriter, patch, buildValueExpression } from './scaffolding';
import { WriterFactory } from './writer';
import { PristineDocument, UpstreamDocument, UpstreamIdentity, PristineCollection } from './document';
import { SingleResourceDoc } from 'jsonapi-typescript';
import cloneDeep from 'lodash/cloneDeep';
import isPlainObject from 'lodash/isPlainObject';
import { CardExpression } from './pgsearch/util';
import { ResponseMeta } from './pgsearch/pgclient';
import * as J from 'json-typescript';
import { IndexerFactory } from './indexer';
import { myOrigin } from './origin';
import { ScopedCardService } from './cards-service';

export const apiPrefix = '/api';

export function canonicalURLToCardId(url: string): CardId {
  let parts = url.split('/');
  let csId = parts.pop()!;
  let nextPart = parts.pop()!;
  let originalRealm;
  if (nextPart !== 'cards') {
    originalRealm = nextPart;
    parts.pop();
  }
  return {
    csRealm: parts.join('/'),
    csOriginalRealm: originalRealm == null ? undefined : decodeURIComponent(originalRealm),
    csId: decodeURIComponent(csId),
  };
}

export function canonicalURL(id: CardId): string {
  let isHome = id.csOriginalRealm === id.csRealm;
  let base = `${myOrigin}${apiPrefix}/realms`;
  let localRealmId = id.csRealm.slice(base.length + 1);
  if (isHome) {
    return [base, localRealmId, 'cards', encodeURIComponent(id.csId)].join('/');
  } else {
    return [
      base,
      localRealmId,
      'cards',
      encodeURIComponent(id.csOriginalRealm ?? id.csRealm),
      encodeURIComponent(id.csId),
    ].join('/');
  }
}

export async function makePristineCollection(
  cards: AddressableCard[],
  meta: ResponseMeta
): Promise<PristineCollection> {
  let pristineDocs = await Promise.all(cards.map(card => card.asPristineDoc()));
  // TODO includeds
  return new PristineCollection({
    data: pristineDocs.map(doc => doc.jsonapi.data),
    meta: (meta as unknown) as J.Object,
  });
}

export class Card {
  // This is the realm the card is stored in.
  csRealm: string;

  // this is the realm the card was first created in. As a card is copied to
  // other realms, `card.csRealm` changes but `card.csOriginalRealm` does not.
  csOriginalRealm: string;

  // the csId distinguishes the card within its originalRealm. In some cases
  // it may be chosen by the person creating the card. In others it may be
  // chosen by the hub.
  csId: string | undefined;

  private jsonapi: SingleResourceDoc;
  private ownFields: Map<string, Card> = new Map();

  // Identity invariants:
  //
  //  - within a given csOriginalRealm, csId is unique.
  //
  //  - [csOriginalRealm, csId] is the globally unique *semantic* identity of a
  //    card. In other words, two Cards with the same [csOriginalRealm, csId]
  //    are "the same card" from the user's perspective, but might be different
  //    "versions" of it, stored in different realms.
  //
  //  - within a given realm, [csOriginalRealm, csId] is unique. That is, we
  //    only allow one version of the same card per realm.
  //
  //  - [csRealm, csOriginalRealm, csId] is globally unique, such that there are
  //    exactly zero or one cards that match it, across all hubs.

  constructor(jsonapi: SingleResourceDoc, realm: string, protected service: ScopedCardService) {
    this.jsonapi = jsonapi;
    this.csRealm = realm;
    this.csOriginalRealm =
      typeof jsonapi.data.attributes?.csOriginalRealm === 'string' ? jsonapi.data.attributes.csOriginalRealm : realm;

    if (typeof jsonapi.data.attributes?.csId === 'string') {
      this.csId = jsonapi.data.attributes?.csId;
    }

    let fields = this.jsonapi.data.attributes?.csFields;
    if (fields) {
      if (!isPlainObject(fields)) {
        throw new CardstackError(`csFields must be an object`);
      }
      for (let [name, value] of Object.entries(fields)) {
        this.ownFields.set(name, service.instantiate(value, this));
      }
    }
  }

  async validate(_priorCard: AddressableCard | null, _realm: AddressableCard, _forDeletion?: true) {}

  async value(name: string): Promise<any> {
    return this.jsonapi.data.attributes?.[name];
  }

  async field(name: string): Promise<Card> {
    let field = this.ownFields.get(name);
    if (field) {
      return field;
    }
    throw new Error(`no such field ${name} on card`);
  }

  protected regenerateJSONAPI(): SingleResourceDoc {
    let copied = cloneDeep(this.jsonapi);
    if (!copied.data.attributes) {
      copied.data.attributes = {};
    }
    copied.data.attributes.csRealm = this.csRealm;
    if (this.csRealm === this.csOriginalRealm) {
      delete copied.data.attributes.csOriginalRealm;
    } else {
      copied.data.attributes.csOriginalRealm = this.csOriginalRealm;
    }
    if (this.csId) {
      copied.data.attributes.csId = this.csId;
    }

    if (this instanceof AddressableCard) {
      copied.data.id = this.canonicalURL;
    }

    return copied;
  }

  async asPristineDoc(): Promise<PristineDocument> {
    return new PristineDocument(this.regenerateJSONAPI());
  }

  async asUpstreamDoc(): Promise<UpstreamDocument> {
    return new UpstreamDocument(this.jsonapi);
  }

  patch(otherDoc: SingleResourceDoc): void {
    patch(this.jsonapi, otherDoc);
  }

  // This is the way that data source plugins think about card IDs. The
  // upstreamId is only unique *within* a realm.
  get upstreamId(): UpstreamIdentity | null {
    if (this.csRealm === this.csOriginalRealm) {
      if (typeof this.csId === 'string') {
        return this.csId;
      } else {
        return null;
      }
    } else {
      if (typeof this.csId === 'string') {
        return { csOriginalRealm: this.csOriginalRealm, csId: this.csId };
      } else {
        throw new CardstackError(`A card originally from a different realm must already have a csId`, {
          status: 400,
        });
      }
    }
  }

  async adoptsFrom(): Promise<AddressableCard | undefined> {
    let adoptsFromRelationship = this.jsonapi.data.relationships?.csAdoptsFrom;
    if (adoptsFromRelationship && `links` in adoptsFromRelationship) {
      let url = adoptsFromRelationship.links.related;
      if (url) {
        if (typeof url !== 'string') {
          url = url.href;
        }
        return await this.service.get(url);
      }
    }
  }
}

export class UnsavedCard extends Card {
  asAddressableCard(): AddressableCard {
    if (typeof this.csId !== 'string') {
      throw new CardstackError(`card missing required attribute "csId"`);
    }
    return new AddressableCard(this.regenerateJSONAPI(), this.service);
  }
}

export class AddressableCard extends UnsavedCard implements CardId {
  // these are non-null because of the assertion in our construction that
  // ensures csId is present.
  csId!: string;
  upstreamId!: NonNullable<Card['upstreamId']>;

  constructor(jsonapi: SingleResourceDoc, service: ScopedCardService) {
    if (typeof jsonapi.data.attributes?.csRealm !== 'string') {
      throw new CardstackError(`card missing required attribute "realm": ${JSON.stringify(jsonapi)}`);
    }
    let realm = jsonapi.data.attributes.csRealm;
    super(jsonapi, realm, service);

    // this is initialized in super() by typescript can't see it.
    if ((this as any).csId == null) {
      throw new Error(`Bug: tried to use an UnsavedCard as a Card`);
    }
  }

  async loadFeature(featureName: 'writer'): Promise<WriterFactory | null>;
  async loadFeature(featureName: 'indexer'): Promise<IndexerFactory<J.Value> | null>;
  async loadFeature(featureName: 'buildValueExpression'): Promise<(expression: CardExpression) => CardExpression>;
  async loadFeature(featureName: any): Promise<any> {
    switch (featureName) {
      case 'writer':
        return await loadWriter(this, this.service);
      case 'indexer':
        return await loadIndexer(this, this.service);
      case 'buildValueExpression':
        return buildValueExpression;
      default:
        throw new Error(`unimplemented loadFeature("${featureName}")`);
    }
  }

  get canonicalURL(): string {
    return canonicalURL(this);
  }
}

export interface CardId {
  csRealm: string;
  csOriginalRealm?: string; // if not set, its implied that its equal to `realm`.
  csId: string;
}
