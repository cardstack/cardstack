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
          csRealm: 'http://not-a-known-realm',
          csId: 'x',
        });
        throw new Error(`should not get here`);
      } catch (err) {
        expect(err.message).to.match(/no such realm/);
      }
    });

    it('can get a card back out', async function() {
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card.csRealm).to.equal(`${myOrigin}/api/realms/first-ephemeral-realm`);

      let foundCard = await service.get(card);
      expect(foundCard.canonicalURL).equals(card.canonicalURL);
    });

    it('can get a card out by canonical URL', async function() {
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let foundCard = await service.get(card.canonicalURL);
      expect(foundCard.canonicalURL).equals(card.canonicalURL);
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

      let doc = testCard()
        .withAttributes({ goodbye: 'world' })
        .adoptingFrom(baseCard);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let parent = await card.adoptsFrom();
      expect(parent?.canonicalURL).to.equal(baseCard.canonicalURL);
    });

    it('can update a card', async function() {
      let doc = testCard().withAttributes({ foo: 'bar' });
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let storage = await env.container.lookup('ephemeralStorage');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.asPristineDoc()).jsonapi.data.meta?.version as number;

      let jsonapi = (await card.asPristineDoc()).jsonapi;
      jsonapi.data.attributes!.foo = 'poo';
      card = await service.update(card, jsonapi);
      let newVersion = (await card.asPristineDoc()).jsonapi.data.meta?.version as number;

      expect(await card.value('foo')).to.equal('poo');
      expect(newVersion).to.be.ok;
      expect(newVersion).to.not.equal(version);
      expect(storage.getEntry(card, card.csRealm)?.doc?.jsonapi.data.attributes?.foo).to.equal('poo');
    });

    it('can update a card by canonical URL', async function() {
      let doc = testCard().withAttributes({ foo: 'bar' });
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);

      let jsonapi = (await card.asPristineDoc()).jsonapi;
      jsonapi.data.attributes!.foo = 'poo';
      card = await service.update(card.canonicalURL, jsonapi);

      expect(await card.value('foo')).to.equal('poo');
    });

    it('can update a card with a patch', async function() {
      let doc = testCard().withAttributes({ foo: 'bar', hello: 'world' });
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);

      let jsonapi = (await card.asPristineDoc()).jsonapi;
      jsonapi.data.attributes!.foo = 'poo';
      delete jsonapi.data.attributes!.hello;

      card = await service.update(card, jsonapi);

      expect(await card.value('foo')).to.equal('poo');
      expect(await card.value('hello')).to.equal('world');
    });

    it('it does not update a card that uses ephemeral storage when the meta.version is missing', async function() {
      let doc = testCard().withAttributes({ foo: 'bar' });
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);

      let jsonapi = (await card.asPristineDoc()).jsonapi;
      jsonapi.data.attributes!.foo = 'poo';
      delete jsonapi.data.meta!.version;

      try {
        await service.update(card.canonicalURL, jsonapi);
        throw new Error(`should not be able to update card`);
      } catch (e) {
        expect(e).hasStatus(400);
        expect(e.message).to.match(/missing required field "meta.version"/);
      }
    });

    it('can delete a card', async function() {
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let storage = await env.container.lookup('ephemeralStorage');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.asPristineDoc()).jsonapi.data.meta?.version as number;
      expect(storage.entriesNewerThan(card.csRealm).filter(entry => Boolean(entry.doc)).length).to.equal(1);

      await service.delete(card, version);

      expect(storage.entriesNewerThan(card.csRealm).filter(entry => Boolean(entry.doc)).length).to.equal(0);
      try {
        await service.get(card);
        throw new Error(`Should not be able to find card`);
      } catch (e) {
        expect(e).hasStatus(404);
      }
    });

    it('can delete a card by canonical URL', async function() {
      let doc = testCard();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.asPristineDoc()).jsonapi.data.meta?.version as number;

      await service.delete(card.canonicalURL, version);

      try {
        await service.get(card);
        throw new Error(`Should not be able to find card`);
      } catch (e) {
        expect(e).hasStatus(404);
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
        expect(e).hasStatus(409);
      }
      let foundCard = await service.get(card);
      expect(foundCard).to.be.ok;
      expect(storage.entriesNewerThan(card.csRealm).filter(entry => Boolean(entry.doc)).length).to.equal(1);
    });

    it('rejects unknown attribute at create', async function() {
      let doc = testCard()
        .withAttributes({ badField: 'hello' })
        .withField('badField', null);

      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/some good error/);
      }
    });

    it.skip('rejects unknown relationship at create', async function() {
      let doc = testCard()
        .withRelationships({
          badField: testCard().withAttributes({ csRealm: 'x', csId: 'y' }),
        })
        .withField('badField', null);

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
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard().withAttributes({ csId: '1' }).jsonapi
      );
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard().withAttributes({ csId: '2' }).jsonapi
      );
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard().withAttributes({
          csId: '1',
          csOriginalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
        }).jsonapi
      );
      await scopedService.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard().withAttributes({
          csId: '2',
          csOriginalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
        }).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard().withAttributes({ csId: '1' }).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard().withAttributes({ csId: '2' }).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard().withAttributes({
          csId: '1',
          csOriginalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
        }).jsonapi
      );
      await scopedService.create(
        `http://example.com/api/realms/second-ephemeral-realm`,
        testCard().withAttributes({
          csId: '2',
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
          eq: { csRealm: `${myOrigin}/api/realms/first-ephemeral-realm` },
        },
      });
      expect(cards.length).equals(4);
      expect(cards.map(c => `${c.csRealm}/${c.csOriginalRealm}/${c.csId}`)).to.eql([
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/2`,
        `${myOrigin}/api/realms/first-ephemeral-realm/${myOrigin}/api/realms/first-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/${myOrigin}/api/realms/first-ephemeral-realm/2`,
      ]);
    });

    it('can filter by csOriginalRealm', async function() {
      let { cards } = await service.as(Session.INTERNAL_PRIVILEGED).search({
        filter: {
          eq: { csOriginalRealm: `http://example.com/api/realms/second-ephemeral-realm` },
        },
      });
      expect(cards.length).equals(4);
      expect(cards.map(c => `${c.csRealm}/${c.csOriginalRealm}/${c.csId}`)).to.eql([
        `http://example.com/api/realms/second-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `http://example.com/api/realms/second-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/2`,
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/2`,
      ]);
    });

    it('can filter by csId', async function() {
      let { cards } = await service.as(Session.INTERNAL_PRIVILEGED).search({
        filter: {
          eq: { csId: '1' },
        },
      });
      expect(cards.length).equals(4);
      expect(cards.map(c => `${c.csRealm}/${c.csOriginalRealm}/${c.csId}`)).to.eql([
        `http://example.com/api/realms/second-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `http://example.com/api/realms/second-ephemeral-realm/${myOrigin}/api/realms/first-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
        `${myOrigin}/api/realms/first-ephemeral-realm/${myOrigin}/api/realms/first-ephemeral-realm/1`,
      ]);
    });

    it('can filter by csRealm and csId and csOriginalRealm', async function() {
      let { cards } = await service.as(Session.INTERNAL_PRIVILEGED).search({
        filter: {
          eq: {
            csRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
            csOriginalRealm: 'http://example.com/api/realms/second-ephemeral-realm',
            csId: '1',
          },
        },
      });
      expect(cards.length).equals(1);
      expect(cards.map(c => `${c.csRealm}/${c.csOriginalRealm}/${c.csId}`)).to.eql([
        `${myOrigin}/api/realms/first-ephemeral-realm/http://example.com/api/realms/second-ephemeral-realm/1`,
      ]);
    });
  });
});
