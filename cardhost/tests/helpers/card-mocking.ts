import { Server } from 'miragejs/server';
import { CompiledCard, RawCard } from './../../../core/src/interfaces';
// import { TestContext } from 'ember-test-helpers';

declare module 'ember-test-helpers' {
  interface TestContext {
    server: Server;
    createCard: typeof createCard;
    lookupCard: typeof lookupCard;
  }
}

export default function setupCardMocking(hooks: NestedHooks): void {
  hooks.beforeEach(function () {
    this.createCard = createCard.bind(this);
    this.lookupCard = lookupCard.bind(this);
  });

  hooks.afterEach(function () {});
}

function createCard(this: TestContext, card: RawCard): unknown {
  return this.server.create('card', { id: card.url, raw: card });
}

function lookupCard(this: TestContext, id: string): Promise<CompiledCard> {
  let response = this.server.schema.cards.find(id);
  if (!response) {
    throw Error(`Could not find card '${id}'. Did you make it?`);
  }
  return response.attrs.raw;
}
