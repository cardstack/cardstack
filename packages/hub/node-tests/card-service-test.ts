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
      let doc = testCard();
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
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let foundCard = await service.get(card);
      expect(foundCard.id).equals(card.id);
    });

    it('can get a card out by canonical URL', async function() {
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let foundCard = await service.get(card.canonicalURL);
      expect(foundCard.id).equals(card.id);
    });

    it("adds upstream data source's version to the card's meta", async function() {
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect((await card.asPristineDoc()).jsonapi.data.meta?.version).to.be.ok;
    });

    it('can create a card that adopts from another', async function() {
      let base = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let baseCard = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, base.jsonapi);

      let doc = testCard({ goodbye: 'world' }).adoptingFrom(baseCard);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let parent = await card.adoptsFrom();
      expect(parent?.id).to.equal(baseCard.id);
    });

    it('can delete a card', async function() {
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let storage = await env.container.lookup('ephemeralStorage');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.asPristineDoc()).jsonapi.data.meta?.version as number;
      expect(storage.entriesNewerThan(card.realm).filter(entry => Boolean(entry.doc)).length).to.equal(1);

      await service.delete(card, version);

      expect(storage.entriesNewerThan(card.realm).filter(entry => Boolean(entry.doc)).length).to.equal(0);
      try {
        await service.get(card);
        throw new Error(`Should not be able to find card`);
      } catch (e) {
        expect(e.status).to.equal(404);
      }
    });

    it('can delete a card by canonical URL', async function() {
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let storage = await env.container.lookup('ephemeralStorage');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.asPristineDoc()).jsonapi.data.meta?.version as number;
      expect(storage.entriesNewerThan(card.realm).filter(entry => Boolean(entry.doc)).length).to.equal(1);

      await service.delete(card.canonicalURL, version);

      expect(storage.entriesNewerThan(card.realm).filter(entry => Boolean(entry.doc)).length).to.equal(0);
      try {
        await service.get(card);
        throw new Error(`Should not be able to find card`);
      } catch (e) {
        expect(e.status).to.equal(404);
      }
    });

    it('does not delete a card that uses ephemeral storage when the specified version is not the latest', async function() {
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let storage = await env.container.lookup('ephemeralStorage');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.asPristineDoc()).jsonapi.data.meta?.version as number;
      let badVersion = version - 1;

      try {
        await service.delete(card, badVersion);
        throw new Error(`Should not be able to delete a card`);
      } catch (e) {
        expect(e.status).to.equal(409);
      }
      let foundCard = await service.get(card);
      expect(foundCard).to.be.ok;
      expect(storage.entriesNewerThan(card.realm).filter(entry => Boolean(entry.doc)).length).to.equal(1);
    });

    it('rejects unknown field value at create', async function() {
      let doc = testCard({ badField: 'hello' }).withField('badField', null);

      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/some good error/);
      }
    });
  });

  describe('readonly', function() {
    let env: TestEnv;
    let service: CardsService;

    before(async function() {
      env = await createTestEnv();
      service = await env.container.lookup('cards');
      let scopedService = service.as(Session.INTERNAL_PRIVILEGED);
      await scopedService.create(`${myOrigin}/api/realms/first-ephemeral-realm`, testCard({ csLocalId: '1' }).jsonapi);
      await scopedService.create(`${myOrigin}/api/realms/first-ephemeral-realm`, testCard({ csLocalId: '2' }).jsonapi);
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard({
          csLocalId: '1',
          csOriginalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
        }).jsonapi
      );
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard({
          csLocalId: '2',
          csOriginalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
        }).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard({ csLocalId: '1' }).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard({ csLocalId: '2' }).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard({
          csLocalId: '1',
          csOriginalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
        }).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard({
          csLocalId: '2',
          csOriginalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
        }).jsonapi
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
          eq: { originalRealm: `http://example.com/api/realms/second-ephemeral-realm` },
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
          eq: { localId: '1' },
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
            originalRealm: 'http://example.com/api/realms/second-ephemeral-realm',
            localId: '1',
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
