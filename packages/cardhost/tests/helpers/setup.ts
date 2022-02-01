import Cards from 'cardhost/services/cards';
import Builder from 'cardhost/lib/builder';
import { LOCAL_REALM } from 'cardhost/lib/builder';
import { setupRenderingTest } from 'ember-qunit';
import { CardId, Format, RawCard } from '@cardstack/core/src/interfaces';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { cardURL } from '@cardstack/core/src/utils';

import type { TestContext } from 'ember-test-helpers';

declare module 'ember-test-helpers' {
  interface TestContext {
    routingCard?: string;
    cardService: Cards;
    builder: Builder;
  }
}

interface CardMockingOptions {
  routingCard: string;
}

// Shorthand to support not passing in the realm when getting a card
function testCardURL(cardId: Partial<CardId> & { id: string }) {
  return cardURL(Object.assign({ realm: LOCAL_REALM }, cardId));
}

export function setupCardTest(hooks: NestedHooks) {
  let context: TestContext | undefined;
  let cardService: Cards;
  let builder: Builder;

  setupRenderingTest(hooks);

  hooks.beforeEach(async function () {
    context = this;
    cardService = this.owner.lookup('service:cards');
    builder = await cardService.builder();
  });

  hooks.afterEach(async function () {
    context = undefined;
  });

  function createCard(rawCard: RawCard) {
    return builder.createRawCard(rawCard);
  }

  async function renderCard(
    cardId: Partial<CardId> & { id: string },
    format: Format = 'isolated'
  ) {
    let { component } = await cardService.load(testCardURL(cardId), format);
    context?.set('component', component);
    await render(hbs`<this.component />`);
  }

  return {
    createCard,
    renderCard,
    localRealmURL: LOCAL_REALM,
  };
}

export function setupBuilder(
  hooks: NestedHooks,
  options?: CardMockingOptions
): void {
  hooks.beforeEach(async function () {
    this.cardService = this.owner.lookup('service:cards');

    if (options) {
      this.cardService.overrideRoutingCardWith = options.routingCard;
    }

    this.builder = await this.cardService.builder();
  });

  hooks.afterEach(function () {
    if (this.routingCard) {
      this.routingCard = undefined;
    }
  });
}
