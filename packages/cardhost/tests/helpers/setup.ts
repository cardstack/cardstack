import Cards from 'cardhost/services/cards';
import Builder from 'cardhost/lib/builder';
import { LOCAL_REALM } from 'cardhost/lib/builder';
import { setupRenderingTest, setupApplicationTest } from 'ember-qunit';
import { CardId, Format, RawCard } from '@cardstack/core/src/interfaces';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { cardURL } from '@cardstack/core/src/utils';

import type { TestContext } from 'ember-test-helpers';

// Shorthand to support not passing in the realm when getting a card
function testCardURL(cardId: Partial<CardId> & { id: string }) {
  return cardURL(Object.assign({ realm: LOCAL_REALM }, cardId));
}

interface IntegrationCardTestOptions {
  type: 'integration';
}
interface ApplicationCardTestOptions {
  type: 'application';
  routingCard?: string;
}
type CardTestOptions = IntegrationCardTestOptions | ApplicationCardTestOptions;

export function setupCardTest(
  hooks: NestedHooks,
  options: CardTestOptions = { type: 'integration' }
) {
  let context: TestContext | undefined;
  let cardService: Cards;
  let builder: Builder;

  switch (options.type) {
    case 'application':
      setupApplicationTest(hooks);
      break;
    case 'integration':
      setupRenderingTest(hooks);
      break;
  }

  hooks.beforeEach(async function () {
    context = this;
    cardService = this.owner.lookup('service:cards');
    if (options.type === 'application') {
      cardService.overrideRoutingCardWith = options.routingCard;
    }
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
