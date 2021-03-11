import { RawCard } from './../../../core/src/interfaces';

export default function setupCardMocking(hooks: NestedHooks) {
  hooks.beforeEach(function () {
    this.createCard = createCard.bind(this);
  });

  hooks.afterEach(function () {
  });
}

function createCard(card: RawCard): void {
  this.server.create('card', { id: card.url, raw: card });
}
