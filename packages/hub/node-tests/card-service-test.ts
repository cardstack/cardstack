import { param } from '../pgsearch/util';
import { createTestEnv, TestEnv } from './helpers';
import { Session } from '../session';
import { myOrigin } from '../origin';
import { testCard } from './test-card';
import CardsService from '../cards-service';

describe('hub/card-service', function() {
  describe('read-write', function() {
    let env: TestEnv;

    beforeEach(async function() {
      env = await createTestEnv();
    });

    afterEach(async function() {
      await env.destroy();
    });

    it('handles get from missing realm', async function() {
      let service = await env.container.lookup('cards');
      try {
        await service.as(Session.EVERYONE).get({
          realm: 'http://not-a-known-realm',
          localId: 'x',
        });
        throw new Error(`should not get here`);
      } catch (err) {
        expect(err.message).to.match(/no such realm/);
      }
    });

    it('saves a card', async function() {
      let doc = testCard({ hello: 'world' });
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card.realm).to.equal(`${myOrigin}/api/realms/first-ephemeral-realm`);

      let pgclient = await env.container.lookup('pgclient');
      let result = await pgclient.queryCards(service, [
        `select * from cards where realm = `,
        param(`${myOrigin}/api/realms/first-ephemeral-realm`),
      ]);
      expect(result.rowCount).equals(1);
    });

    it('can get a card back out', async function() {
      let doc = testCard({ hello: 'world' });
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let foundCard = await service.get(card);
      expect(foundCard.id).equals(card.id);
    });

    // TODO we can do this now--the ephemeral data source is now keeping track of generation
    it.skip("adds upstream data source's version to the card's meta", async function() {});
  });

  describe('readonly', function() {
    let env: TestEnv;
    let service: CardsService;

    before(async function() {
      env = await createTestEnv();
      service = await env.container.lookup('cards');
      let scopedService = service.as(Session.INTERNAL_PRIVILEGED);
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard({ localId: '1' }, {}).jsonapi
      );
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard({ localId: '2' }, {}).jsonapi
      );
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard(
          {
            localId: '1',
            originalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
          },
          {}
        ).jsonapi
      );
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard(
          {
            localId: '2',
            originalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
          },
          {}
        ).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard({ localId: '1' }, {}).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard({ localId: '2' }, {}).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard(
          {
            localId: '1',
            originalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
          },
          {}
        ).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard(
          {
            localId: '2',
            originalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
          },
          {}
        ).jsonapi
      );
    });

    after(async function() {
      await env.destroy();
    });

    it('can filter by realm', async function() {
      let { cards } = await service.as(Session.INTERNAL_PRIVILEGED).search({
        filter: {
          eq: { realm: `${myOrigin}/api/realms/first-ephemeral-realm` },
        },
      });
      expect(cards.length).equals(4);
      expect(cards.map(c => `${c.realm}/${c.originalRealm}/${c.localId}`)).to.eql([
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/2`,
        `${myOrigin}/api/realms/first-ephemeral-realm/${myOrigin}/api/realms/first-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/${myOrigin}/api/realms/first-ephemeral-realm/2`,
      ]);
    });

    it('can filter by original-realm', async function() {
      let { cards } = await service.as(Session.INTERNAL_PRIVILEGED).search({
        filter: {
          eq: { 'original-realm': `http://example.com/api/realms/second-ephemeral-realm` },
        },
      });
      expect(cards.length).equals(4);
      expect(cards.map(c => `${c.realm}/${c.originalRealm}/${c.localId}`)).to.eql([
        `http://example.com/api/realms/second-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `http://example.com/api/realms/second-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/2`,
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/2`,
      ]);
    });

    it('can filter by local-id', async function() {
      let { cards } = await service.as(Session.INTERNAL_PRIVILEGED).search({
        filter: {
          eq: { 'local-id': '1' },
        },
      });
      expect(cards.length).equals(4);
      expect(cards.map(c => `${c.realm}/${c.originalRealm}/${c.localId}`)).to.eql([
        `http://example.com/api/realms/second-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `http://example.com/api/realms/second-ephemeral-realm/${myOrigin}/api/realms/first-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/${myOrigin}/api/realms/first-ephemeral-realm/1`,
      ]);
    });

    it('can filter by realm and local-id and original-realm', async function() {
      let { cards } = await service.as(Session.INTERNAL_PRIVILEGED).search({
        filter: {
          eq: {
            realm: `${myOrigin}/api/realms/first-ephemeral-realm`,
            'original-realm': 'http://example.com/api/realms/second-ephemeral-realm',
            'local-id': '1',
          },
        },
      });
      expect(cards.length).equals(1);
      expect(cards.map(c => `${c.realm}/${c.originalRealm}/${c.localId}`)).to.eql([
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
      ]);
    });
  });
});
