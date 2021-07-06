import { Server } from 'miragejs/server';
import {
  CompiledCard,
  FEATURE_NAMES,
  RawCard,
} from '@cardstack/core/src/interfaces';
import type { TestContext } from 'ember-test-helpers';
import {
  encodeCardURL,
  getBasenameAndExtension,
} from '@cardstack/core/src/utils';

declare module 'ember-test-helpers' {
  interface TestContext {
    server: Server;
    routingCard?: string;
    createCard: typeof createCard;
    lookupCard: typeof lookupCard;
  }
}

const BASE_CARD_NAMES = ['base', 'string', 'date'];

async function loadBaseCards() {
  let BASE_CARDS: RawCard[] = [];
  for (const name of BASE_CARD_NAMES) {
    let card = (await import(`@cardstack/base-cards/${name}/card.json`))
      .default;
    card.url = `https://cardstack.com/base/${name}`;
    card.files = {};

    for (const feature of FEATURE_NAMES) {
      let fileName = card[feature];
      if (!fileName) {
        continue;
      }
      let { basename } = getBasenameAndExtension(fileName);
      // TODO: The assumption of JS here is sketchty, but webpack blows a gasket if no extension is presest
      card.files[fileName] = (
        await import(`!raw-loader!@cardstack/base-cards/${name}/${basename}.js`)
      ).default;
    }

    BASE_CARDS.push(card);
  }
  return BASE_CARDS;
}

// NOTE: Mirage must be setup before this. ie:
//    setupMirage(hooks);
//    setupCardMocking(hooks);
interface CardMockingOptions {
  routingCard: string;
}

export default function setupCardMocking(
  hooks: NestedHooks,
  options: CardMockingOptions
): void {
  hooks.beforeEach(async function () {
    this.createCard = createCard.bind(this);
    this.lookupCard = lookupCard.bind(this);

    if (options) {
      this.routingCard = options.routingCard;
    }

    const BASE_CARDS = await loadBaseCards();
    BASE_CARDS.forEach((card) => this.createCard(card));
  });

  hooks.afterEach(function () {});
}

function createCard(this: TestContext, card: RawCard): unknown {
  return this.server.create('card', { id: encodeCardURL(card.url), raw: card });
}

function lookupCard(this: TestContext, id: string): Promise<CompiledCard> {
  let { schema } = this.server as any;
  let response = schema.cards.find(id);
  if (!response) {
    throw Error(`Could not find card '${id}'. Did you make it?`);
  }
  return response.attrs.raw;
}
