import { TestEnv, createTestEnv } from './helpers';
import { EphemeralStorage } from '../ephemeral/storage';
import IndexingService from '../indexing';
import { testCard } from './test-card';
import { myOrigin } from '../origin';
import CardsService from '../cards-service';
import { Session } from '../session';
import { wireItUp } from '../main';

describe('hub/indexing', function() {
  let env: TestEnv, storage: EphemeralStorage, indexing: IndexingService, cards: CardsService;

  beforeEach(async function() {
    env = await createTestEnv();
    storage = await env.container.lookup('ephemeralStorage');
    indexing = await env.container.lookup('indexing');
    cards = await env.container.lookup('cards');
  });

  afterEach(async function() {
    await env.destroy();
  });

  async function createRealm(originalRealm: string, csId: string) {
    await cards.as(Session.INTERNAL_PRIVILEGED).create(
      `${myOrigin}/api/realms/meta`,
      testCard().withAutoAttributes({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: originalRealm,
        csId: csId,
      }).jsonapi
    );
  }

  it('it can index a realm', async function() {
    let csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, csRealm);
    let card = testCard().withAutoAttributes({ csRealm, csId: '1', foo: 'bar' });
    storage.store(card.upstreamDoc, card.csId, card.csRealm);

    await indexing.update();

    let indexedCard = await cards.as(Session.INTERNAL_PRIVILEGED).get(card);
    expect(indexedCard).to.be.ok;
  });

  it('it can remove a document from the index if the document was removed from the data source', async function() {
    let csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, csRealm);
    let card = await cards
      .as(Session.INTERNAL_PRIVILEGED)
      .create(csRealm, testCard().withAutoAttributes({ csRealm, csId: '1', foo: 'bar' }).jsonapi);
    storage.store(null, card.csId, card.csRealm, storage.getEntry(card, csRealm)?.generation);
    await indexing.update();

    let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { csId: '1' } },
    });
    expect(results.length).to.equal(0);
  });

  it('it can index multiple realms', async function() {
    let realm1 = `${myOrigin}/api/realms/first-ephemeral-realm`;
    let realm2 = `http://example.com/api/realms/second-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, realm1);
    await createRealm(`http://example.com/api/realms/meta`, realm2);

    let card = testCard().withAutoAttributes({ csRealm: realm1, csId: '1', foo: 'bar' });
    storage.store(card.upstreamDoc, card.csId, card.csRealm);
    card = testCard().withAutoAttributes({ csRealm: realm2, csId: '1', foo: 'bar' });
    storage.store(card.upstreamDoc, card.csId, card.csRealm);

    await indexing.update();

    let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { csId: '1' } },
    });
    expect(results.length).to.equal(2);
  });

  it('ephemeral cards do not persist in the index between container teardowns', async function() {
    let realm = `${myOrigin}/api/realms/first-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, realm);

    // card is indexed in torn down ephemeral storage
    // This card will _not_ live through the container teardown
    let card = testCard().withAutoAttributes({ csRealm: realm, csId: '1', foo: 'bar' });
    storage.store(card.upstreamDoc, card.csId, card.csRealm);
    await indexing.update();

    // card is not yet indexed in torn down ephemeral storage
    // This card will _not_ live through the container teardown
    card = testCard().withAutoAttributes({ csRealm: realm, csId: '2', foo: 'bar' });
    storage.store(await card.upstreamDoc, card.csId, card.csRealm);
    await env.container.teardown();
    env.container = await wireItUp();

    cards = await env.container.lookup('cards');
    indexing = await env.container.lookup('indexing');
    storage = await env.container.lookup('ephemeralStorage');
    (await env.container.lookup('queue')).launchJobRunner();

    // card is not yet indexed in new ephemeral storage
    // This card _will_ live through the container teardown
    card = testCard().withAutoAttributes({ csRealm: realm, csId: '3', foo: 'bar' });
    storage.store(await card.upstreamDoc, card.csId, card.csRealm);
    await indexing.update();

    let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { csId: '1' } },
    });
    expect(results.length).to.equal(0);

    ({ cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { csId: '2' } },
    }));
    expect(results.length).to.equal(0);

    ({ cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { csId: '3' } },
    }));
    expect(results.length).to.equal(1);
  });

  it('it does not index unchanged cards since the last time the ephemeral realm was indexed', async function() {
    let realm = `${myOrigin}/api/realms/first-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, realm);

    let steps = await cards.as(Session.INTERNAL_PRIVILEGED).create(
      realm,
      testCard()
        .withField('foo', 'string-field')
        .withField('step', 'integer-field').jsonapi
    );

    async function cardsWithStep(n: number): Promise<number> {
      let found = await cards.as(Session.INTERNAL_PRIVILEGED).search({
        filter: {
          type: steps,
          eq: {
            step: n,
          },
        },
      });
      return found.cards.length;
    }

    // Add a new card
    let card = testCard()
      .withAttributes({ csRealm: realm, csId: '1', foo: 'bar', step: 1 })
      .adoptingFrom(steps);
    storage.store(card.upstreamDoc, card.csId, card.csRealm);
    await indexing.update();
    expect(await cardsWithStep(1)).to.equal(1);

    // Add another new card
    card = testCard()
      .withAttributes({ csRealm: realm, csId: '2', foo: 'bar', step: 2 })
      .adoptingFrom(steps);
    storage.store(card.upstreamDoc, card.csId, card.csRealm);

    // Maniuplate existing card so we would notice if it gets indexed when it shouldn't.
    await storage.inThePast(async () => {
      card = testCard()
        .withAttributes({ csRealm: realm, csId: '1', foo: 'bar', step: 2 })
        .adoptingFrom(steps);
      storage.store(card.upstreamDoc, card.csId, card.csRealm, storage.getEntry('1', realm)?.generation);
    });

    await indexing.update();
    let n = await cardsWithStep(2);
    expect(n).to.equal(1);

    // Update first card
    card = testCard()
      .withAttributes({ csRealm: realm, csId: '1', foo: 'bar', step: 3 })
      .adoptingFrom(steps);
    storage.store(card.upstreamDoc, card.csId, card.csRealm, storage.getEntry('1', realm)?.generation);

    // Maniuplate other existing card so we would notice if it gets indexed when it shouldn't.
    await storage.inThePast(async () => {
      card = testCard()
        .withAttributes({ csRealm: realm, csId: '2', foo: 'bar', step: 3 })
        .adoptingFrom(steps);
      storage.store(card.upstreamDoc, card.csId, card.csRealm, storage.getEntry('2', realm)?.generation);
    });

    await indexing.update();
    expect(await cardsWithStep(3)).to.equal(1);

    // Delete card 2
    storage.store(null, card.csId, card.csRealm, storage.getEntry('2', realm)?.generation);

    // Maniuplate other existing card so we would notice if it gets indexed when it shouldn't.
    await storage.inThePast(async () => {
      card = testCard()
        .withAttributes({ csRealm: realm, csId: '1', foo: 'bar', step: 4 })
        .adoptingFrom(steps);
      storage.store(card.upstreamDoc, card.csId, card.csRealm, storage.getEntry('1', realm)?.generation);
    });

    await indexing.update();
    expect(await cardsWithStep(4)).to.equal(0);

    // stable case
    await indexing.update();
    expect(await cardsWithStep(4)).to.equal(0);
  });
});
