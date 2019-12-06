import { CardWithId } from '../card';
import { param } from '../pgsearch/util';
import { createTestEnv, TestEnv } from './helpers';
import { testCard } from './test-card';
import { Session } from '../session';

describe('hub/pgclient', function() {
  let env: TestEnv;

  beforeEach(async function() {
    env = await createTestEnv();
  });

  afterEach(async function() {
    await env.destroy();
  });

  it('it can access the database', async function() {
    let pgclient = await env.container.lookup('pgclient');
    let cardsService = await env.container.lookup('cards');
    let cards = cardsService.as(Session.INTERNAL_PRIVILEGED);
    let result = await pgclient.query(cards, ['select 1']);
    expect(result.rowCount).equals(1);
  });

  it('saves a card', async function() {
    let card = new CardWithId(
      testCard({ localId: 'card-1', realm: `http://hassan.com/realm` }, { hello: 'world' }).jsonapi
    );
    let pgclient = await env.container.lookup('pgclient');
    let cardsService = await env.container.lookup('cards');
    let cards = cardsService.as(Session.INTERNAL_PRIVILEGED);

    let batch = pgclient.beginBatch(cards);
    await batch.save(card);
    await batch.done();

    let result = await pgclient.query(cards, [`select * from cards where local_id = `, param('card-1')]);
    expect(result.rowCount).equals(1);
  });
});
