import type { TestContext } from 'ember-test-helpers';
import Cards from 'cardhost/services/cards';
import LocalRealm from 'cardhost/lib/local-realm';

declare module 'ember-test-helpers' {
  interface TestContext {
    routingCard?: string;
    cardService(): Cards;
    localRealm: LocalRealm;
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

    this.localRealm = await this.cardService().localRealm();
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
