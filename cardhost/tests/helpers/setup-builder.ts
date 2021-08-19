import Cards from 'cardhost/services/cards';
import Builder from 'cardhost/lib/builder';

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

export default function setupBuilder(
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
