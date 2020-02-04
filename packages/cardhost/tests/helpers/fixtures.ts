/// <reference types="qunit" />

import DAGMap from 'dag-map';
import { CardDocumentWithId, CardDocument } from '@cardstack/core/card-document';
import { CardId, canonicalURL } from '@cardstack/core/card-id';
import { stringify } from 'qs';
import flatten from 'lodash/flatten';
import uniq from 'lodash/uniq';
import { CollectionResourceDoc, ResourceObject, SingleResourceDoc, ResourceIdentifierObject } from 'jsonapi-typescript';
import isPlainObject from 'lodash/isPlainObject';

const hubURL = 'http://localhost:3000';

export interface FixtureConfig {
  create?: CardDocument[];
  csRealm?: string;
  destroy?: {
    cards?: CardId[];
    cardTypes?: CardId[];
  };
}

export default class Fixtures {
  private createdCards: CardId[] | undefined;

  constructor(private config: FixtureConfig) {}

  setupModule(hooks: NestedHooks) {
    hooks.before(async () => await this.setup());
    hooks.after(async () => await this.teardown());
  }

  setupTest(hooks: NestedHooks) {
    hooks.beforeEach(async () => await this.setup());
    hooks.afterEach(async () => await this.teardown());
  }

  async setup() {
    if (!Array.isArray(this.config.create)) {
      return;
    }
    let cardResources: ResourceObject[] = [];
    assignCardIds(this.config.create, this.config.csRealm);

    for (let card of inDependencyOrder(this.config.create)) {
      cardResources.push(await createCard(card));
    }
    this.createdCards = cardResources.map(
      i =>
        ({
          csId: i.attributes?.csId,
          csRealm: i.attributes?.csRealm,
          csOriginalRealm: i.attributes?.csOriginalRealm,
        } as CardId)
    );
  }

  async teardown() {
    let cardsToDestroy: ResourceObject[] = [];
    if (Array.isArray(this.createdCards)) {
      let cardIdsToDestroy = [...this.createdCards, ...(this.config.destroy?.cards || [])];
      cardsToDestroy = [...(await Promise.all(cardIdsToDestroy.map(getCard)))];
    }

    if (Array.isArray(this.config.destroy?.cardTypes)) {
      cardsToDestroy = cardsToDestroy.concat(
        flatten(await Promise.all(this.config.destroy!.cardTypes.map(getCardsOfType)))
      );
    }
    for (let card of inDependencyOrder(cardsToDestroy).reverse()) {
      await deleteCard((card.attributes as unknown) as CardId, String(card.meta?.version));
    }
  }
}

function inDependencyOrder(cards: ResourceObject[]): ResourceObject[];
function inDependencyOrder(cards: CardDocumentWithId[]): CardDocumentWithId[];
function inDependencyOrder(cards: any[]): any[] {
  let dag = new DAGMap<CardDocumentWithId>();

  for (let card of cards) {
    let json: ResourceObject = 'jsonapi' in card ? card.jsonapi.data : card;
    dag.add(canonicalURL((json.attributes as unknown) as CardId), card, undefined, getRelatedIds(json));
  }
  let sortedCreatedCards: CardDocumentWithId[] = [];
  dag.each((_key, value) => sortedCreatedCards.push(value!));
  // filter out any built-in cards, as those are never supplied in the fixtures
  // and only appear as references with undefined values in the DAG.
  return sortedCreatedCards.filter(Boolean);
}

function getRelatedIds(cardValue: CardDocument['asCardValue']): string[] {
  return uniq(
    flatten([
      ...Object.values(cardValue.relationships || {}).map(value => {
        if (!('data' in value) || value.data == null) {
          return;
        }
        if (Array.isArray(value.data)) {
          return (value.data as ResourceIdentifierObject[]).map(i => i.id);
        } else {
          return value.data.id;
        }
      }),
      ...Object.values(cardValue.attributes || {}).map(value =>
        isPlainObject(value) ? getRelatedIds(value as CardDocument['asCardValue']) : null
      ),
    ]).filter(Boolean)
  ) as string[];
}

async function getCardsOfType(cardType: CardId): Promise<ResourceObject[]> {
  let filter = {
    filter: {
      type: cardType,
    },
    page: {
      size: 1000,
    },
  };
  let response = await fetch(`${hubURL}/api/cards?${stringify(filter)}`, {
    headers: {
      'Content-Type': 'application/vnd.api+json',
    },
  });
  let { data: cards } = (await response.json()) as CollectionResourceDoc;
  return cards;
}

async function getCard(id: CardId): Promise<ResourceObject> {
  let response = await fetch(localURL(id), {
    headers: {
      'Content-Type': 'application/vnd.api+json',
    },
  });
  let json = (await response.json()) as SingleResourceDoc;
  if (!response.ok) {
    throw new Error(`Cannot get card ${response.status}: ${response.statusText} - ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function createCard(card: CardDocumentWithId): Promise<ResourceObject> {
  let response = await fetch(localURL(card, true), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify(card.jsonapi),
  });
  let json = (await response.json()) as SingleResourceDoc;
  if (!response.ok) {
    throw new Error(`Cannot save card ${response.status}: ${response.statusText} - ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function deleteCard(id: CardId, version: string) {
  await fetch(localURL(id), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'If-Match': version,
    },
  });
}

function localURL(id: CardId, isCreate?: true): string {
  let { csRealm, csId, csOriginalRealm } = id;
  if (csRealm == null) {
    throw new Error(`Must specify a csRealm in order to fashion card URL`);
  }
  let isLocalRealm = csRealm.includes(hubURL);
  let requestRealm = isLocalRealm ? csRealm.split('/').pop() : csRealm;
  let url = isLocalRealm
    ? `${hubURL}/api/realms/${encodeURIComponent(requestRealm!)}/cards`
    : csOriginalRealm
    ? `${hubURL}/api/remote-realms/${encodeURIComponent(requestRealm!)}/cards/${encodeURIComponent(csOriginalRealm)}`
    : `${hubURL}/api/remote-realms/${encodeURIComponent(requestRealm!)}/cards`;
  if (csId != null && !isCreate) {
    url = `${url}/${encodeURIComponent(csId)}`;
  }
  return url;
}

function makeId(): string {
  return String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
}

function assignCardIds(cards: CardDocument[], csRealm?: string): asserts cards is CardDocumentWithId[] {
  for (let card of cards) {
    if (card.csId != null && card.csRealm != null) {
      continue;
    }

    if (csRealm == null && card.csRealm == null) {
      throw new Error(`Must specify csRealm in the Fixture constructor in order to assign test card's a csRealm.`);
    }
    if (card.csRealm == null) {
      card.csRealm = csRealm;
      card.csOriginalRealm = csRealm;
    }
    if (card.csId == null) {
      card.csId = makeId();
    }
  }
}
