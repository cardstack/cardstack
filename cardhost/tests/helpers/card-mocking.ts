import type { TestContext } from 'ember-test-helpers';
import Cards from 'cardhost/services/cards';

declare module 'ember-test-helpers' {
  interface TestContext {
    routingCard?: string;
    cardService: typeof cardService;
  }
}

interface CardMockingOptions {
  routingCard: string;
}

export default function setupCardMocking(
  hooks: NestedHooks,
  options?: CardMockingOptions
): void {
  hooks.beforeEach(async function () {
    this.cardService = cardService.bind(this);

    if (options) {
      this.routingCard = options.routingCard;
    }
  });

  hooks.afterEach(function () {
    if (this.routingCard) {
      this.routingCard = undefined;
    }
  });
}

function cardService(this: TestContext): Cards {
  return this.owner.lookup('service:cards');
}
