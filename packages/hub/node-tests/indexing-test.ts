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
    await createRealm(`${myOrigin}/api/realms/meta`, `${myOrigin}/api/realms/first-ephemeral-realm`);
    let card = new CardWithId(
      testCard({ realm: `${myOrigin}/api/realms/first-ephemeral-realm`, localId: '1' }, { foo: 'bar' }).jsonapi
    );
    storage.save(await card.asUpstreamDoc(), card.localId, card.realm);

    await indexing.update();

    let indexedCard = await cards.as(Session.INTERNAL_PRIVILEGED).get(card);
    expect(indexedCard).to.be.ok;
  });

  it('it can index multiple realms', async function() {
    await createRealm(`${myOrigin}/api/realms/meta`, `${myOrigin}/api/realms/first-ephemeral-realm`);
    await createRealm(`http://example.com/api/realms/meta`, `http://example.com/api/realms/second-ephemeral-realm`);

    let card = new CardWithId(
      testCard({ realm: `${myOrigin}/api/realms/first-ephemeral-realm`, localId: '1' }, { foo: 'bar' }).jsonapi
    );
    storage.save(await card.asUpstreamDoc(), card.localId, card.realm);
    card = new CardWithId(
      testCard({ realm: `http://example.com/api/realms/second-ephemeral-realm`, localId: '1' }, { foo: 'bar' }).jsonapi
    );
    storage.save(await card.asUpstreamDoc(), card.localId, card.realm);

    await indexing.update();

    let { cards: results } = await cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: { eq: { 'local-id': '1' } },
    });
    expect(results.length).to.equal(2);
  });

  it('ephemeral cards do not persist in the index between container teardowns', async function() {
    await createRealm(`${myOrigin}/api/realms/meta`, `${myOrigin}/api/realms/first-ephemeral-realm`);

    let card = new CardWithId(
      testCard({ realm: `${myOrigin}/api/realms/first-ephemeral-realm`, localId: '1' }, { foo: 'bar' }).jsonapi
    );
    // card is indexed in torn down ephemeral storage
    // This card will _not_ live through the container teardown
    storage.save(await card.asUpstreamDoc(), card.localId, card.realm);
    await indexing.update();

    card = new CardWithId(
      testCard({ realm: `${myOrigin}/api/realms/first-ephemeral-realm`, localId: '2' }, { foo: 'bar' }).jsonapi
    );
    // card is not yet indexed in torn down ephemeral storage
    // This card will _not_ live through the container teardown
    storage.save(await card.asUpstreamDoc(), card.localId, card.realm);
    await env.container.teardown();
    env.container = await wireItUp({ suppressInitialIndex: true });

    cards = await env.container.lookup('cards');
    indexing = await env.container.lookup('indexing');
    storage = await env.container.lookup('ephemeralStorage');

    card = new CardWithId(
      testCard({ realm: `${myOrigin}/api/realms/first-ephemeral-realm`, localId: '3' }, { foo: 'bar' }).jsonapi
    );
    // card is not yet indexed in new ephemeral storage
    // This card _will_ live through the container teardown
    storage.save(await card.asUpstreamDoc(), card.localId, card.realm);
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

  it.skip('it does not index unchanged cards since the last time the ephemeral realm was indexed', async function() {});
});
