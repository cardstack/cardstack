/// <reference types="qunit" />

import { TestCard } from '@cardstack/test-support/test-card';
import { CardId } from '@cardstack/core/card';
import { stringify } from 'qs';
import { CollectionResourceDoc, ResourceObject } from 'jsonapi-typescript';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const hubURL = 'http://localhost:3000';

export interface FixtureConfig {
  create?: TestCard[];
  destroy?: {
    cards?: CardId[];
    cardTypes?: CardId[];
  };
}

export default class Fixtures {
  constructor(private config: FixtureConfig) {
    this.config;
  }

  setupTest(hooks: NestedHooks) {
    hooks.beforeEach(async () => await this.setup());
    hooks.afterEach(async () => await this.teardown());
  }

  async setup() {
    // TODO
  }

  async teardown() {
    // TODO also implement this.config.destroy.cards to destroy cards by their ID
    if (Array.isArray(this.config.destroy?.cardTypes)) {
      for (let cardType of this.config.destroy!.cardTypes) {
        let cardsToDestroy = await getCardsOfType(cardType);
        cardsToDestroy = cardsToDestroy.filter(i => i.attributes?.csRealm !== CARDSTACK_PUBLIC_REALM);
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

async function deleteCard(id: CardId, version: string) {
  let localRealm = id.csRealm.split('/').pop(); // probably wanna handle remote realms too...
  await fetch(`${hubURL}/api/realms/${localRealm}/cards/${id.csId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'If-Match': version,
    },
  });
}
