import { TestEnv, createTestEnv } from './helpers';
import { EphemeralStorage } from '../ephemeral/storage';
import IndexingService from '../indexing';
import { testCard } from './test-card';
import { myOrigin } from '../origin';
import { CardWithId } from '../card';
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

  async function createRealm(originalRealm: string, localId: string) {
    await cards.as(Session.INTERNAL_PRIVILEGED).create(
      `${myOrigin}/api/realms/meta`,
      testCard(
        {
          realm: `${myOrigin}/api/realms/meta`,
          originalRealm,
          localId,
        },
        {}
      ).jsonapi
    );
  }

  it('it can index a realm', async function() {
    let realm = `${myOrigin}/api/realms/first-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, realm);
    let card = new CardWithId(testCard({ realm, localId: '1' }, { foo: 'bar' }).jsonapi);
    storage.store(await card.asUpstreamDoc(), card.localId, card.realm);

    await indexing.update();

    let indexedCard = await cards.as(Session.INTERNAL_PRIVILEGED).get(card);
    expect(indexedCard).to.be.ok;
  });

  it('it can remove a document from the index if the document was removed from the data source', async function() {
    let realm = `${myOrigin}/api/realms/first-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, realm);
    let card = await cards
      .as(Session.INTERNAL_PRIVILEGED)
      .create(realm, testCard({ realm, localId: '1' }, { foo: 'bar' }).jsonapi);
    storage.store(null, card.localId, card.realm);
    await indexing.update();

    let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { 'local-id': '1' } },
    });
    expect(results.length).to.equal(0);
  });

  it('it can index multiple realms', async function() {
    let realm1 = `${myOrigin}/api/realms/first-ephemeral-realm`;
    let realm2 = `http://example.com/api/realms/second-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, realm1);
    await createRealm(`http://example.com/api/realms/meta`, realm2);

    let card = new CardWithId(testCard({ realm: realm1, localId: '1' }, { foo: 'bar' }).jsonapi);
    storage.store(await card.asUpstreamDoc(), card.localId, card.realm);
    card = new CardWithId(testCard({ realm: realm2, localId: '1' }, { foo: 'bar' }).jsonapi);
    storage.store(await card.asUpstreamDoc(), card.localId, card.realm);

    await indexing.update();

    let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { 'local-id': '1' } },
    });
    expect(results.length).to.equal(2);
  });

  it('ephemeral cards do not persist in the index between container teardowns', async function() {
    let realm = `${myOrigin}/api/realms/first-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, realm);

    // card is indexed in torn down ephemeral storage
    // This card will _not_ live through the container teardown
    let card = new CardWithId(testCard({ realm, localId: '1' }, { foo: 'bar' }).jsonapi);
    storage.store(await card.asUpstreamDoc(), card.localId, card.realm);
    await indexing.update();

    // card is not yet indexed in torn down ephemeral storage
    // This card will _not_ live through the container teardown
    card = new CardWithId(testCard({ realm, localId: '2' }, { foo: 'bar' }).jsonapi);
    storage.store(await card.asUpstreamDoc(), card.localId, card.realm);
    await env.container.teardown();
    env.container = await wireItUp();

    cards = await env.container.lookup('cards');
    indexing = await env.container.lookup('indexing');
    storage = await env.container.lookup('ephemeralStorage');

    // card is not yet indexed in new ephemeral storage
    // This card _will_ live through the container teardown
    card = new CardWithId(testCard({ realm, localId: '3' }, { foo: 'bar' }).jsonapi);
    storage.store(await card.asUpstreamDoc(), card.localId, card.realm);
    await indexing.update();

    let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { 'local-id': '1' } },
    });
    expect(results.length).to.equal(0);

    ({ cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { 'local-id': '2' } },
    }));
    expect(results.length).to.equal(0);

    ({ cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { 'local-id': '3' } },
    }));
    expect(results.length).to.equal(1);
  });

  it('it does not index unchanged cards since the last time the ephemeral realm was indexed', async function() {
    async function cardsWithStep(n: number): Promise<number> {
      let found = await cards.as(Session.INTERNAL_PRIVILEGED).search({});
      let steps = await Promise.all(found.cards.map(c => c.field('step')));
      return steps.filter(step => step === n).length;
    }

    let realm = `${myOrigin}/api/realms/first-ephemeral-realm`;
    await createRealm(`${myOrigin}/api/realms/meta`, realm);

    // Add a new card
    let card = new CardWithId(testCard({ realm, localId: '1' }, { foo: 'bar', step: 1 }).jsonapi);
    storage.store(await card.asUpstreamDoc(), card.localId, card.realm);
    await indexing.update();
    expect(await cardsWithStep(1)).to.equal(1);

    // Add another new card
    card = new CardWithId(testCard({ realm, localId: '2' }, { foo: 'bar', step: 2 }).jsonapi);
    storage.store(await card.asUpstreamDoc(), card.localId, card.realm);

    // Maniuplate existing card so we would notice if it gets indexed when it shouldn't.
    await storage.inThePast(async () => {
      card = new CardWithId(testCard({ realm, localId: '1' }, { foo: 'bar', step: 2 }).jsonapi);
      storage.store(await card.asUpstreamDoc(), card.localId, card.realm);
    });

    await indexing.update();
    let n = await cardsWithStep(2);
    expect(n).to.equal(1);

    // Update first card
    card = new CardWithId(testCard({ realm, localId: '1' }, { foo: 'bar', step: 3 }).jsonapi);
    storage.store(await card.asUpstreamDoc(), card.localId, card.realm);

    // Maniuplate other existing card so we would notice if it gets indexed when it shouldn't.
    await storage.inThePast(async () => {
      card = new CardWithId(testCard({ realm, localId: '2' }, { foo: 'bar', step: 3 }).jsonapi);
      storage.store(await card.asUpstreamDoc(), card.localId, card.realm);
    });

    await indexing.update();
    expect(await cardsWithStep(3)).to.equal(1);

    // Delete card 2
    storage.store(null, card.localId, card.realm);

    // Maniuplate other existing card so we would notice if it gets indexed when it shouldn't.
    await storage.inThePast(async () => {
      card = new CardWithId(testCard({ realm, localId: '1' }, { foo: 'bar', step: 4 }).jsonapi);
      storage.store(await card.asUpstreamDoc(), card.localId, card.realm);
    });

    await indexing.update();
    expect(await cardsWithStep(4)).to.equal(0);

    // stable case
    await indexing.update();
    expect(await cardsWithStep(4)).to.equal(0);
  });
});
