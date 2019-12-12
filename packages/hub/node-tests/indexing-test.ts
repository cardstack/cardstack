import { TestEnv, createTestEnv } from './helpers';
import { EphemeralStorage } from '../ephemeral/storage';
import IndexingService from '../indexing';
import { testCard } from './test-card';
import { myOrigin } from '../origin';
import { CardWithId } from '../card';
import CardsService from '../cards-service';
import { Session } from '../session';

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

  async function createRealm(localId: string) {
    await cards.as(Session.INTERNAL_PRIVILEGED).create(
      `${myOrigin}/api/realms/meta`,
      testCard(
        {
          realm: `${myOrigin}/api/realms/meta`,
          originalRealm: `${myOrigin}/api/realms/meta`,
          localId,
        },
        {}
      ).jsonapi
    );
  }

  it('it can index a realm', async function() {
    await createRealm(`${myOrigin}/api/realms/first-ephemeral-realm`);
    let card = new CardWithId(
      testCard({ realm: `${myOrigin}/api/realms/first-ephemeral-realm`, localId: '1' }, { foo: 'bar' }).jsonapi
    );
    storage.save(await card.asUpstreamDoc(), card.localId, card.realm);

    await indexing.update();

    let indexedCard = await cards.as(Session.INTERNAL_PRIVILEGED).get(card);
    expect(indexedCard).to.be.ok;
  });

  it.skip('it can index multiple realms', async function() {});
  it.skip('ephemeral cards do not persist in the index between container teardowns', async function() {});
  it.skip('it does not index unchanged cards since the last time the ephemeral realm was indexed', async function() {});
});
