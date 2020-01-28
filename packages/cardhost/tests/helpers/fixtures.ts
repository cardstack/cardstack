/// <reference types="qunit" />

import { TestCardWithId } from '@cardstack/test-support/test-card';
import { CardId } from '@cardstack/core/card';
import { stringify } from 'qs';
import { CollectionResourceDoc, ResourceObject, SingleResourceDoc } from 'jsonapi-typescript';

const hubURL = 'http://localhost:3000';

export interface FixtureConfig {
  create?: TestCardWithId[];
  destroy?: {
    cards?: CardId[];
    cardTypes?: CardId[];
  };
}

export default class Fixtures {
  private createdCards: CardId[] | undefined;

  constructor(private config: FixtureConfig) {}

  setupTest(hooks: NestedHooks) {
    this.setupTestWithBeforeEachAndAfterEach(hooks);
  }

  setupTestWithBeforeAndAfter(hooks: NestedHooks) {
    hooks.before(async () => await this.setup());
    hooks.after(async () => await this.teardown());
  }

  setupTestWithBeforeEachAndAfterEach(hooks: NestedHooks) {
    hooks.before(async () => await this.setup());
    hooks.after(async () => await this.teardown());
  }

  async setup() {
    if (!Array.isArray(this.config.create)) {
      return;
    }
    let cardResources: ResourceObject[] = [];
    // TODO: consider using an adoption chain based DAG instead for creating
    // these in the correct order.
    for (let card of this.config.create) {
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
    if (Array.isArray(this.createdCards)) {
      // TODO Right now we are relying on the fact that the dev is specifying the
      // cards to create/delete in the correct order it would be better to rely
      // on an adoption chain based DAG instead.
      let cardIdsToDestroy = [...this.createdCards, ...(this.config.destroy?.cards || [])].reverse();
      let cardsToDestroy = await Promise.all(cardIdsToDestroy.map(getCard));
      for (let card of cardsToDestroy) {
        let version = card.meta?.version;
        await deleteCard((card.attributes as unknown) as CardId, String(version));
      }
    }

    if (Array.isArray(this.config.destroy?.cardTypes)) {
      for (let cardType of this.config.destroy!.cardTypes) {
        let cardsToDestroy = await getCardsOfType(cardType);
        // TODO using a Promise.all for deletion can be problematic if you have
        // cards that derive from one another. What we should really do is to
        // create a DAG of cards based on their adoption chains and delete from
        // the leaves up.
        await Promise.all(
          cardsToDestroy.map(card => {
            let version = card.meta?.version;
            return deleteCard((card.attributes as unknown) as CardId, String(version));
          })
        );
      }
    }
  }
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

async function createCard(card: TestCardWithId): Promise<ResourceObject> {
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
