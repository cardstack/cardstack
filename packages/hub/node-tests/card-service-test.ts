import { AddressableCard } from '@cardstack/core/card';
import { canonicalURL } from '@cardstack/core/card-id';
import { ScopedCardService } from '../cards-service';
import { myOrigin } from '../origin';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { Session } from '@cardstack/core/session';
import { createTestEnv, TestEnv } from './helpers';
import { cardDocument } from '@cardstack/core/card-document';
import { Value } from 'json-typescript';

describe('hub/card-service', function() {
  describe('read-write', function() {
    let env: TestEnv;
    let service: ScopedCardService;

    beforeEach(async function() {
      env = await createTestEnv();
      service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
    });

    afterEach(async function() {
      await env.destroy();
    });

    it('handles get from missing realm', async function() {
      try {
        await service.get({
          csRealm: 'http://not-a-known-realm',
          csId: 'x',
        });
        throw new Error(`should not get here`);
      } catch (err) {
        expect(err.message).to.match(/no such realm/);
      }
    });

    it('can get a card back out', async function() {
      let doc = cardDocument();
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card.csRealm).to.equal(`${myOrigin}/api/realms/first-ephemeral-realm`);

      let foundCard = await service.get(card);
      expect(foundCard.canonicalURL).equals(card.canonicalURL);
    });

    it('can get a card out by canonical URL', async function() {
      let doc = cardDocument();
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let foundCard = await service.get(card.canonicalURL);
      expect(foundCard.canonicalURL).equals(card.canonicalURL);
    });

    it('deserializes url field values as URLs', async function() {
      let doc = cardDocument()
        .withAttributes({ link: 'https://cardstack.com' })
        .withField('link', 'url-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let url = (await card.value('link')) as URL;
      expect(url instanceof URL).to.equal(true, 'url-field deserializes to a URL instance');
      expect(url.toString()).to.equal('https://cardstack.com/');
    });

    it('deserializes date field values as strings', async function() {
      let doc = cardDocument()
        .withAttributes({ birthday: '2019-10-30' })
        .withField('birthday', 'date-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let date = await card.value('birthday');
      expect(date).to.equal('2019-10-30');
    });

    it('deserializes datetime field values as Dates', async function() {
      let doc = cardDocument()
        .withAttributes({ appointment: '2020-03-07T14:00:00.000Z' })
        .withField('appointment', 'datetime-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let date = (await card.value('appointment')) as Date;
      expect(date instanceof Date).to.equal(true, 'the datetime field value is an instance of Date');
      expect(date.toISOString()).to.equal('2020-03-07T14:00:00.000Z');
    });

    it("adds upstream data source's version to the card's meta", async function() {
      let doc = cardDocument();
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect((await card.serializeAsJsonAPIDoc()).data.meta?.version).to.be.ok;
    });

    it('can create a card that adopts from another', async function() {
      let parentCard = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);

      let doc = cardDocument()
        .withAutoAttributes({ goodbye: 'world' })
        .adoptingFrom(parentCard);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let parent = await card.adoptsFrom();
      expect(parent?.canonicalURL).to.equal(parentCard.canonicalURL);
    });

    it('defaults to adopting from the base card if no csAdoptsFrom is specified', async function() {
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
      let parent = await card.adoptsFrom();
      expect(parent?.canonicalURL).to.equal(canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }));
    });

    it('does not support multiple adoption', async function() {
      let card1 = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
      let card2 = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, {
          data: {
            type: 'cards',
            relationships: {
              csAdoptsFrom: {
                data: [
                  { type: 'cards', id: card1.canonicalURL },
                  { type: 'cards', id: card2.canonicalURL },
                ],
              },
            },
          },
        });
        throw new Error(`should not be able to create card`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.message).to.match(/The card .* adopts from multiple parents.* Multiple adoption is not allowed/);
      }
    });

    it('does not support csAdoptsFrom as an attribute', async function() {
      let parentCard = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, {
          data: {
            type: 'cards',
            attributes: {
              csAdoptsFrom: ((await parentCard.serializeAsJsonAPIDoc()).data as unknown) as Value,
            },
          },
        });
        throw new Error(`should not be able to create card`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.message).to.match(/csAdoptsFrom must be a reference, not a value/);
      }
    });

    it('can update a card', async function() {
      let doc = cardDocument().withAutoAttributes({ foo: 'bar' });
      let storage = await env.container.lookup('ephemeralStorage');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.serializeAsJsonAPIDoc()).data.meta?.version as number;

      let jsonapi = await card.serializeAsJsonAPIDoc();
      jsonapi.data.attributes!.foo = 'poo';
      card = await service.update(card, jsonapi);
      let newVersion = (await card.serializeAsJsonAPIDoc()).data.meta?.version as number;

      expect(await card.value('foo')).to.equal('poo');
      expect(newVersion).to.be.ok;
      expect(newVersion).to.not.equal(version);
      expect(storage.getEntry(card, card.csRealm)?.doc?.jsonapi.data.attributes?.foo).to.equal('poo');
    });

    it('can update a card by canonical URL', async function() {
      let doc = cardDocument().withAutoAttributes({ foo: 'bar' });
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);

      let jsonapi = await card.serializeAsJsonAPIDoc();
      jsonapi.data.attributes!.foo = 'poo';
      card = await service.update(card.canonicalURL, jsonapi);

      expect(await card.value('foo')).to.equal('poo');
    });

    it('can update a card with a patch', async function() {
      let doc = cardDocument().withAutoAttributes({ foo: 'bar', hello: 'world' });
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);

      let jsonapi = await card.serializeAsJsonAPIDoc();
      jsonapi.data.attributes!.foo = 'poo';
      delete jsonapi.data.attributes!.hello;

      card = await service.update(card, jsonapi);

      expect(await card.value('foo')).to.equal('poo');
      expect(await card.value('hello')).to.equal('world');
    });

    it('can patch csFields', async function() {
      let doc = cardDocument().withField('foo', 'string-field', 'singular');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let field = await card.field('foo');
      expect(field.csTitle).to.be.undefined;

      let updated = card.document;
      updated.withField('foo', 'string-field', 'singular', { csTitle: 'FoOo' });
      card = await service.update(card, updated.jsonapi);

      field = await card.field('foo');
      expect(field.csTitle).to.equal('FoOo');
    });

    it('can add a new field that has a field value', async function() {
      let doc = cardDocument().withAutoAttributes({ foo: 'bar', hello: 'world' });
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      doc = card.document.withAttributes({ boo: 'baz' }).withField('boo', 'string-field');
      card = await service.update(card, doc.jsonapi);

      expect(await card.value('boo')).to.equal('baz');
    });

    it('can remove a field with an attribute value from a card with a patch', async function() {
      let doc: any = cardDocument().withAutoAttributes({ foo: 'bar' }).jsonapi;
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc);

      delete doc.data.attributes.csFields.foo;
      let updatedCard = await service.update(card, doc);

      try {
        await updatedCard.field('foo');
        throw new Error(`should not be able to get field`);
      } catch (err) {
        expect(err.detail).to.equal('no such field "foo"');
      }
    });

    it('can remove a field with a relationships value from a card with a patch', async function() {
      let related = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
      let doc: any = cardDocument().withAutoRelationships({ foo: related }).jsonapi;
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc);

      delete doc.data.attributes.csFields.foo;
      card = await service.update(card, doc);

      try {
        await card.field('foo');
        throw new Error(`should not be able to get field`);
      } catch (err) {
        expect(err.detail).to.equal('no such field "foo"');
      }
    });

    it('new cards have a csCreated and a csUpdated attribute', async function() {
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
      let csCreated = card.csCreated?.toISOString();
      let csUpdated = card.csUpdated?.toISOString();
      expect(card.csCreated).to.be.ok;
      expect(card.csUpdated).to.be.ok;
      expect(csCreated).to.equal(csUpdated);

      card = await service.get(card);
      expect(card.csCreated).to.be.ok;
      expect(card.csUpdated).to.be.ok;
      expect(card.csCreated?.toISOString()).to.equal(csCreated);
      expect(card.csUpdated?.toISOString()).to.equal(csCreated);
    });

    it('the csCreated attribute does not change when a card is patched', async function() {
      let doc = cardDocument().withField('foo', 'string-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let csCreated = card.csCreated?.toISOString();

      doc.withAttributes({ foo: 'bar' });
      let updatedCard = await service.update(card, doc.jsonapi);
      expect(updatedCard.csCreated?.toISOString()).to.equal(csCreated);
      card = await service.get(card);
      expect(card.csCreated?.toISOString()).to.equal(csCreated);
    });

    it('the csUpdated attribute changes when a card is patched', async function() {
      let doc = cardDocument().withField('foo', 'string-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let csUpdated = card.csUpdated?.toISOString();

      doc.withAttributes({ foo: 'bar' });
      let updatedCard = await service.update(card, doc.jsonapi);
      expect(updatedCard.csUpdated).to.be.ok;
      expect(updatedCard.csUpdated?.toISOString()).to.not.equal(csUpdated);

      csUpdated = updatedCard.csUpdated?.toISOString();
      card = await service.get(card);
      expect(card.csUpdated?.toISOString()).to.equal(csUpdated);
    });

    it('interior cards do not have a csCreated nor a csUpdated attribute', async function() {
      let interiorCardType = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().jsonapi
      );
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .withAttributes({
            card: cardDocument().adoptingFrom(interiorCardType).asCardValue,
          })
          .withField('card', interiorCardType).jsonapi
      );
      let interiorCard = await card.value('card');
      expect(interiorCard.csCreated).to.be.undefined;
      expect(interiorCard.csUpdated).to.be.undefined;
    });

    it('it does not update a card that uses ephemeral storage when the meta.version is missing', async function() {
      let doc = cardDocument().withAutoAttributes({ foo: 'bar' });
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);

      let jsonapi = await card.serializeAsJsonAPIDoc();
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
      let doc = cardDocument();
      let storage = await env.container.lookup('ephemeralStorage');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.serializeAsJsonAPIDoc()).data.meta?.version as number;
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
      let doc = cardDocument();
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.serializeAsJsonAPIDoc()).data.meta?.version as number;

      await service.delete(card.canonicalURL, version);

      try {
        await service.get(card);
        throw new Error(`Should not be able to find card`);
      } catch (e) {
        expect(e).hasStatus(404);
      }
    });

    it('does not delete a card that uses ephemeral storage when the specified version is not the latest', async function() {
      let doc = cardDocument();
      let storage = await env.container.lookup('ephemeralStorage');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let version = (await card.serializeAsJsonAPIDoc()).data.meta?.version as number;
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

    it('can search by user-defined field', async function() {
      let post = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withField('title', 'string-field').jsonapi
      );
      let matchingPost = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .withAttributes({ title: 'hello' })
          .adoptingFrom(post).jsonapi
      );
      await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .withAttributes({ title: 'goodbye' })
          .adoptingFrom(post).jsonapi
      );
      // deliberately unrelated card which happens to use the same field name
      await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withAutoAttributes({ title: 'hello', iAmUnrelated: true }).jsonapi
      );
      let foundCards = await service.search({
        filter: {
          type: post,
          eq: {
            title: 'hello',
          },
        },
      });
      expect(foundCards.cards.length).to.equal(1);
      expect(foundCards.cards[0].canonicalURL).to.equal(matchingPost.canonicalURL);
    });

    it('rejects unknown attribute at create', async function() {
      let doc = cardDocument().withAttributes({ badField: 'hello' });

      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/no such field "badField"/);
      }
    });

    it('rejects unknown relationship at create', async function() {
      let doc = cardDocument().withRelationships({
        badField: cardDocument().withAutoAttributes({ csRealm: 'x', csId: 'y' }),
      });

      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/no such field "badField"/);
      }
    });

    it('rejects the creation of a "cs" prefixed field at create', async function() {
      let doc = {
        data: {
          type: 'cards',
          attributes: {
            csFields: {
              csBadField: {
                relationships: {
                  csAdoptsFrom: {
                    data: {
                      type: 'cards',
                      id: canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'string-field' }),
                    },
                  },
                },
              },
            },
          },
        },
      };

      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /Cannot create user field 'csBadField'. 'cs' prefixed fields are reserved for system use only/
        );
      }
    });

    it('applies string field type validation at create', async function() {
      let doc = cardDocument()
        .withAttributes({
          title: 42,
        })
        .withField('title', 'string-field');

      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field title on card .* failed type validation for value: 42/);
      }

      doc = cardDocument()
        .withAttributes({
          title: 'test',
        })
        .withField('title', 'string-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card).is.ok;
      expect(await card.value('title')).to.equal('test');
    });

    it('applies boolean field type validation at create', async function() {
      let doc = cardDocument()
        .withAttributes({
          isCool: 42,
        })
        .withField('isCool', 'boolean-field');

      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field isCool on card .* failed type validation for value: 42/);
      }
      doc = cardDocument()
        .withAttributes({
          isCool: true,
        })
        .withField('isCool', 'boolean-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card).is.ok;
      expect(await card.value('isCool')).to.equal(true);
    });

    it('applies integer field type validation at create', async function() {
      let doc = cardDocument()
        .withAttributes({
          puppyCount: 'what',
        })
        .withField('puppyCount', 'integer-field');

      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field puppyCount on card .* failed type validation for value: "what"/);
      }
      doc = cardDocument()
        .withAttributes({
          puppyCount: 42,
        })
        .withField('puppyCount', 'integer-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card).is.ok;
      expect(await card.value('puppyCount')).to.equal(42);
    });

    it('applies date field type validation at create', async function() {
      let doc = cardDocument()
        .withAttributes({ birthday: 'what' })
        .withField('birthday', 'date-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field birthday on card .* failed type validation for value: "what"/);
      }

      doc = cardDocument()
        .withAttributes({ birthday: '2020-12-45' })
        .withField('birthday', 'date-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field birthday on card .* failed type validation for value: "2020-12-45"/);
      }

      doc = cardDocument()
        .withAttributes({ birthday: '2020-20-12' })
        .withField('birthday', 'date-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field birthday on card .* failed type validation for value: "2020-20-12"/);
      }

      doc = cardDocument()
        .withAttributes({ birthday: 5 })
        .withField('birthday', 'date-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field birthday on card .* failed type validation for value: 5/);
      }

      doc = cardDocument()
        .withAttributes({ birthday: '9999999-01-01' })
        .withField('birthday', 'date-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field birthday on card .* failed type validation for value: "9999999-01-01"/);
      }

      doc = cardDocument()
        .withAttributes({ birthday: '2019-10-30' })
        .withField('birthday', 'date-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card).is.ok;
      expect(await card.value('birthday')).to.equal('2019-10-30');
    });

    it('applies datetime field type validation at create', async function() {
      let doc = cardDocument()
        .withAttributes({ appointment: 'what' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field appointment on card .* failed type validation for value: "what"/);
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-12-45T00:00:00.000Z' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field appointment on card .* failed type validation for value: "2020-12-45T00:00:00.000Z"/
        );
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-20-12T00:00:00.000Z' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field appointment on card .* failed type validation for value: "2020-20-12T00:00:00.000Z"/
        );
      }

      doc = cardDocument()
        .withAttributes({ appointment: 5 })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field appointment on card .* failed type validation for value: 5/);
      }

      doc = cardDocument()
        .withAttributes({ appointment: '9999999-01-01T00:00:00.000Z' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field appointment on card .* failed type validation for value: "9999999-01-01T00:00:00.000Z"/
        );
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-03-07' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field appointment on card .* failed type validation for value: "2020-03-07"/);
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-03-07T14:00:00.000' }) // missing "Z" which is the indicator that the time is in UTC
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field appointment on card .* failed type validation for value: "2020-03-07T14:00:00.000"/
        );
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-03-07T34:00:00.000Z' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field appointment on card .* failed type validation for value: "2020-03-07T34:00:00.000Z"/
        );
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-03-07T14:70:00.000Z' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field appointment on card .* failed type validation for value: "2020-03-07T14:70:00.000Z"/
        );
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-03-07T14:00:70.000Z' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field appointment on card .* failed type validation for value: "2020-03-07T14:00:70.000Z"/
        );
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-03-07T14:00:00Z' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field appointment on card .* failed type validation for value: "2020-03-07T14:00:00Z"/
        );
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-03-07T14:00:00.00Z' })
        .withField('appointment', 'datetime-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field appointment on card .* failed type validation for value: "2020-03-07T14:00:00.00Z"/
        );
      }

      doc = cardDocument()
        .withAttributes({ appointment: '2020-03-07T14:00:00.999Z' })
        .withField('appointment', 'datetime-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card).is.ok;
      expect((await card.value('appointment')).toISOString()).to.equal('2020-03-07T14:00:00.999Z');
    });

    it('rejects dates that are not in a simplified ISO-8601 format of YYYY-MM-DD', async function() {
      let doc = cardDocument()
        .withAttributes({ birthday: '10/30/2019' })
        .withField('birthday', 'date-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field birthday on card .* failed type validation for value: "10\/30\/2019"/);
      }
    });

    it('rejects dates that specify a time, e.g. 2020-02-27T12:00:00Z (this requires the ISO-8601 datetime-field so we can respect timezones)', async function() {
      let doc = cardDocument()
        .withAttributes({ birthday: '2019-10-30T00:00:00Z' })
        .withField('birthday', 'date-field');
      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(
          /field birthday on card .* failed type validation for value: "2019-10-30T00:00:00Z"/
        );
      }
    });

    it('applies url field type validation', async function() {
      let doc = cardDocument()
        .withAttributes({
          link: 'not a url',
        })
        .withField('link', 'url-field');

      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field link on card .* failed type validation for value: "not a url"/);
      }

      doc = cardDocument()
        .withAttributes({
          link: 'https://cardstack.com',
        })
        .withField('link', 'url-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card).is.ok;
      expect((await card.value('link')).toString()).to.equal('https://cardstack.com/');
    });

    it('applies string field type validation during update', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withField('title', 'string-field').jsonapi
      );

      try {
        await service.update(card, {
          data: {
            type: 'cards',
            attributes: {
              title: 42,
            },
          },
        });
        throw new Error(`should not have been able to update`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field title on card .* failed type validation for value: 42/);
      }

      let updatedCard = await service.update(card, {
        data: {
          type: 'cards',
          attributes: {
            title: 'test',
          },
        },
      });
      expect(updatedCard).is.ok;
      expect(await updatedCard.value('title')).to.equal('test');
    });

    it('applies boolean field type validation during update', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withField('isCool', 'boolean-field').jsonapi
      );

      try {
        await service.update(card, {
          data: {
            type: 'cards',
            attributes: {
              isCool: 42,
            },
          },
        });
        throw new Error(`should not have been able to update`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field isCool on card .* failed type validation for value: 42/);
      }

      let updatedCard = await service.update(card, {
        data: {
          type: 'cards',
          attributes: {
            isCool: true,
          },
        },
      });
      expect(updatedCard).is.ok;
      expect(await updatedCard.value('isCool')).to.equal(true);
    });

    it('applies date field type validation during update', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withField('birthday', 'date-field').jsonapi
      );

      try {
        await service.update(card, {
          data: {
            type: 'cards',
            attributes: {
              birthday: 'what',
            },
          },
        });
        throw new Error(`should not have been able to update`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field birthday on card .* failed type validation for value: "what"/);
      }

      let updatedCard = await service.update(card, {
        data: {
          type: 'cards',
          attributes: {
            birthday: '2019-10-30',
          },
        },
      });
      expect(updatedCard).is.ok;
      expect(await updatedCard.value('birthday')).to.equal('2019-10-30');
    });

    it('applies datetime field type validation during update', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withField('appointment', 'datetime-field').jsonapi
      );

      try {
        await service.update(card, {
          data: {
            type: 'cards',
            attributes: {
              appointment: 'what',
            },
          },
        });
        throw new Error(`should not have been able to update`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field appointment on card .* failed type validation for value: "what"/);
      }

      let updatedCard = await service.update(card, {
        data: {
          type: 'cards',
          attributes: {
            appointment: '2020-03-07T14:00:00.000Z',
          },
        },
      });
      expect(updatedCard).is.ok;
      expect((await updatedCard.value('appointment')).toISOString()).to.equal('2020-03-07T14:00:00.000Z');
    });

    it('applies integer field type validation during update', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withField('puppyCount', 'integer-field').jsonapi
      );

      try {
        await service.update(card, {
          data: {
            type: 'cards',
            attributes: {
              puppyCount: 'what',
            },
          },
        });
        throw new Error(`should not have been able to update`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/field puppyCount on card .* failed type validation for value: "what"/);
      }

      let updatedCard = await service.update(card, {
        data: {
          type: 'cards',
          attributes: {
            puppyCount: 42,
          },
        },
      });
      expect(updatedCard).is.ok;
      expect(await updatedCard.value('puppyCount')).to.equal(42);
    });

    it('can set field order', async function() {
      let puppyCard = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withField('name', 'string-field').jsonapi
      );

      let mango = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .withAttributes({
            csFieldOrder: ['numberOfSpots', 'name'],
          })
          .withField('numberOfSpots', 'integer-field')
          .adoptingFrom(puppyCard).jsonapi
      );
      expect(mango.csFieldOrder).to.eql(['numberOfSpots', 'name']);
    });

    it('rejects non-existant field in field order', async function() {
      try {
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument().withAttributes({
            csFieldOrder: ['badField'],
          }).jsonapi
        );
        throw new Error(`should not have been able to update`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/no such field "badField"/);
      }
    });

    describe('fields filled with cards', function() {
      let addressCard: AddressableCard, userCard: AddressableCard;

      beforeEach(async function() {
        addressCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('streetAddress', 'string-field')
            .withField('city', 'string-field')
            .withField('state', 'string-field')
            .withField('zip', 'string-field').jsonapi
        );
        userCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('name', 'string-field')
            .withField('address', addressCard).jsonapi
        );
      });

      it('can set a composite field in a card as card value', async function() {
        let validUser = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Mango',
              address: cardDocument().withAttributes({
                streetAddress: '123 Bone St.',
                city: 'Barkyville',
                state: 'MA',
                zip: '01234',
              }).asCardValue, // not specifying adoptingFrom(), since that is inferred from the field definition
            })
            .adoptingFrom(userCard).jsonapi
        );

        expect(validUser).to.be.ok;
        expect(await validUser.value('name')).to.equal('Mango');
        let validAddress = await validUser.value('address');
        expect(await validAddress.value('streetAddress')).to.equal('123 Bone St.');
      });

      it('can patch an interior field within a composite field of a card', async function() {
        let validUser = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Mango',
              address: cardDocument().withAttributes({
                streetAddress: '123 Bone St.',
                city: 'Barkyville',
                state: 'MA',
                zip: '01234',
              }).asCardValue,
            })
            .adoptingFrom(userCard).jsonapi
        );

        let updatedUser = await service.update(validUser, {
          data: {
            type: 'cards',
            attributes: {
              address: {
                attributes: {
                  state: 'NY',
                },
              },
            },
          },
        });

        let address = await updatedUser.value('address');
        expect(await address.value('streetAddress')).to.equal('123 Bone St.');
        expect(await address.value('state')).to.equal('NY');
      });

      it('rejects a card-as-value that has a field that appears in both the attributes and the relationships of an interior card', async function() {
        let friendCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('friend', userCard)
            .adoptingFrom(userCard).jsonapi
        );
        let homeAddress = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              streetAddress: '123 Bone St.',
              city: 'Barkyville',
              state: 'MA',
              zip: '01234',
            })
            .adoptingFrom(addressCard).jsonapi
        );
        try {
          await service.create(
            `${myOrigin}/api/realms/first-ephemeral-realm`,
            cardDocument()
              .withAttributes({
                name: 'Van Gogh',
                friend: cardDocument()
                  .withAttributes({
                    name: 'Mango',
                    address: (await homeAddress.serializeAsJsonAPIDoc()).data,
                  })
                  .withRelationships({ address: homeAddress })
                  .adoptingFrom(friendCard).asCardValue,
              })
              .adoptingFrom(friendCard).jsonapi
          );
          throw new Error('should not have created card');
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(
            /The field address cannot appear in both the relationships and attributes of a card/
          );
        }
      });

      it('cannnot set an interior field with arity > 1 when the interior cards are not addressable', async function() {
        let personCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument().withField('addresses', addressCard, 'plural').jsonapi
        );
        try {
          await service.create(
            `${myOrigin}/api/realms/first-ephemeral-realm`,
            cardDocument()
              .withAttributes({
                addresses: [
                  cardDocument()
                    .withAttributes({
                      streetAddress: '123 Bone St.',
                      city: 'Barkyville',
                      state: 'MA',
                      zip: '01234',
                    })
                    .adoptingFrom(addressCard).asCardValue,
                ],
              })
              .adoptingFrom(personCard).jsonapi
          );
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/Fields with arity > 1 can only be set with addressable cards/);
        }
      });

      it('can patch an interior field with arity > 1 when the interior cards are addressable', async function() {
        let csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
        let personCard = await service.create(
          csRealm,
          cardDocument()
            .withField('name', 'string-field')
            .withField('addresses', addressCard, 'plural').jsonapi
        );
        let address1 = cardDocument()
          .withAttributes({
            csRealm,
            csId: 'address1',
            streetAddress: '123 Bone St.',
            city: 'Barkyville',
            state: 'MA',
            zip: '01234',
          })
          .adoptingFrom(addressCard);
        let address2 = cardDocument()
          .withAttributes({
            csRealm,
            csId: 'address2',
            streetAddress: '456 Treat Street',
            city: 'Wag Town',
            state: 'MA',
            zip: '05678',
          })
          .adoptingFrom(addressCard);
        let address3 = cardDocument()
          .withAttributes({
            csRealm,
            csId: 'address3',
            streetAddress: '789 Treat Street',
            city: 'Wag Town',
            state: 'MA',
            zip: '05678',
          })
          .adoptingFrom(addressCard);

        let person = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({
              name: 'Van Gogh',
              addresses: [address1.asCardValue, address2.asCardValue],
            })
            .adoptingFrom(personCard).jsonapi
        );

        let updatedPerson = await service.update(person, {
          data: {
            type: 'cards',
            attributes: {
              addresses: [address1.asCardValue as Value, address3.asCardValue as Value],
            },
          },
        });

        expect(await updatedPerson.value('name')).to.equal('Van Gogh');
        let addresses = await updatedPerson.value('addresses');
        expect(addresses.length).to.equal(2);
        expect(await addresses[0].value('streetAddress')).to.equal('123 Bone St.');
        expect(await addresses[1].value('streetAddress')).to.equal('789 Treat Street');
      });

      it('applies field type validation to interior field of composite field', async function() {
        let doc = cardDocument()
          .withAttributes({
            name: 'Mango',
            address: {
              attributes: {
                streetAddress: true,
              },
            },
          })
          .adoptingFrom(userCard);

        try {
          await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
          throw new Error(`should not have been able to create`);
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/field streetAddress on card .* failed type validation for value: true/);
        }
      });

      it('ignores composite field value with unknown interior field', async function() {
        let doc = cardDocument()
          .withAttributes({
            name: 'Mango',
            address: {
              attributes: {
                badField: 'this is not a valid field',
              },
            },
          })
          .adoptingFrom(userCard);

        let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        try {
          await card.field('badField');
          throw new Error(`should not be able to get field value`);
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/no such field "badField"/);
        }
      });

      it('can set a field with a card reference', async function() {
        let homeAddress = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              streetAddress: '123 Bone St.',
              city: 'Barkyville',
              state: 'MA',
              zip: '01234',
            })
            .adoptingFrom(addressCard).jsonapi
        );

        let user = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({ name: 'Mango' })
            .withRelationships({ address: homeAddress })
            .adoptingFrom(userCard).jsonapi
        );

        expect(user).to.be.ok;
        expect(await user.value('name')).to.equal('Mango');
        let validAddress = await user.value('address');
        expect(await validAddress.value('streetAddress')).to.equal('123 Bone St.');
      });

      it('rejects a card reference that is not the correct card type', async function() {
        let nonAddressCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('streetAddress', 'string-field')
            .withField('city', 'string-field')
            .withField('state', 'string-field')
            .withField('zip', 'string-field').jsonapi
        );
        let notActuallyAnAddress = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              streetAddress: '123 Bone St.',
              city: 'Barkyville',
              state: 'MA',
              zip: '01234',
            })
            .adoptingFrom(nonAddressCard).jsonapi
        );

        let doc = cardDocument()
          .withAttributes({ name: 'Mango' })
          .withRelationships({ address: notActuallyAnAddress })
          .adoptingFrom(userCard);

        try {
          await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
          throw new Error(`should not have been able to create`);
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/field address on card .* failed card-type validation/);
        }
      });

      it('rejects a card reference that is not the correct arity', async function() {
        let puppyCard = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
        let addressCard = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
        let mango = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument().adoptingFrom(puppyCard).jsonapi
        );
        let home = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument().adoptingFrom(addressCard).jsonapi
        );
        let ownerCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('address', addressCard, 'singular')
            .withField('puppies', puppyCard, 'plural').jsonapi
        );

        try {
          await service.create(
            `${myOrigin}/api/realms/first-ephemeral-realm`,
            cardDocument()
              .withRelationships({
                puppies: mango,
              })
              .adoptingFrom(ownerCard).jsonapi
          );
          throw new Error(`should not have been able to create`);
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/field puppies on card .* failed arity validation .* field has a plural arity/);
        }

        try {
          await service.create(
            `${myOrigin}/api/realms/first-ephemeral-realm`,
            cardDocument()
              .withRelationships({
                address: [home],
              })
              .adoptingFrom(ownerCard).jsonapi
          );
          throw new Error(`should not have been able to create`);
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/field address on card .* failed arity validation .* field has a singular arity/);
        }
      });

      it('rejects a card value that is not the correct arity', async function() {
        let puppyCard = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
        let addressCard = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, cardDocument().jsonapi);
        let ownerCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('address', addressCard, 'singular')
            .withField('puppies', puppyCard, 'plural').jsonapi
        );

        try {
          await service.create(
            `${myOrigin}/api/realms/first-ephemeral-realm`,
            cardDocument()
              .withAttributes({
                puppies: cardDocument().adoptingFrom(puppyCard).asCardValue,
              })
              .adoptingFrom(ownerCard).jsonapi
          );
          throw new Error(`should not have been able to create`);
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/field puppies on card .* failed arity validation .* field has a plural arity/);
        }

        try {
          await service.create(
            `${myOrigin}/api/realms/first-ephemeral-realm`,
            cardDocument()
              .withAttributes({
                address: [cardDocument().adoptingFrom(addressCard).asCardValue],
              })
              .adoptingFrom(ownerCard).jsonapi
          );
          throw new Error(`should not have been able to create`);
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/field address on card .* failed arity validation .* field has a singular arity/);
        }
      });

      it('rejects a specific card value when validating a field that has arity > 1', async function() {
        let csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
        let puppyCard = await service.create(csRealm, cardDocument().withField('name', 'string-field').jsonapi);
        let ownerCard = await service.create(csRealm, cardDocument().withField('puppies', puppyCard, 'plural').jsonapi);
        try {
          await service.create(
            `${myOrigin}/api/realms/first-ephemeral-realm`,
            cardDocument()
              .withAttributes({
                puppies: [
                  cardDocument()
                    .withAttributes({
                      csRealm,
                      csId: 'mango',
                      name: 'mango',
                    })
                    .adoptingFrom(puppyCard).asCardValue,
                  cardDocument()
                    .withAttributes({
                      csRealm,
                      csId: 'vangogh',
                      name: 42,
                    })
                    .adoptingFrom(puppyCard).asCardValue,
                ],
              })
              .adoptingFrom(ownerCard).jsonapi
          );
          throw new Error(`should not have been able to create`);
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/field name on card .* failed type validation/);
        }
      });

      it('can break a cycle in the search doc', async function() {
        let friendCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('friend', userCard)
            .adoptingFrom(userCard).jsonapi
        );
        let user1 = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Deandra',
            })
            .adoptingFrom(friendCard).jsonapi
        );
        let user2 = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Alice',
            })
            .withRelationships({ friend: user1 })
            .adoptingFrom(friendCard).jsonapi
        );
        let user3 = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Monique',
            })
            .withRelationships({ friend: user2 })
            .adoptingFrom(friendCard).jsonapi
        );
        user1 = await service.update(user1, {
          data: {
            type: 'cards',
            relationships: {
              friend: {
                data: { type: 'cards', id: user3.canonicalURL },
              },
            },
          },
        });

        let searchDoc = await user1.asSearchDoc();
        let friendField = `${friendCard.canonicalURL}/friend`;
        expect(searchDoc).to.have.nested.property(`csId`, user1.csId);
        expect(searchDoc).to.have.nested.property(`${friendField}.csId`, user3.csId);
        expect(searchDoc).to.have.nested.property(`${friendField}.${friendField}.csId`, user2.csId);
        expect(searchDoc).to.not.have.nested.property(`${friendField}.${friendField}.${friendField}`);
      });
    });
  });

  describe('readonly', function() {
    describe('system fields', function() {
      let env: TestEnv;
      let service: ScopedCardService;
      before(async function() {
        env = await createTestEnv();
        service = (await env.container.lookup('cards')).as(Session.EVERYONE);
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument().withAutoAttributes({ csId: '1' }).jsonapi
        );
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument().withAutoAttributes({ csId: '2' }).jsonapi
        );
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument().withAutoAttributes({
            csId: '1',
            csOriginalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
          }).jsonapi
        );
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument().withAutoAttributes({
            csId: '2',
            csOriginalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
          }).jsonapi
        );
        await service.create(
          `http://example.com/api/realms/second-ephemeral-realm`,
          cardDocument().withAutoAttributes({ csId: '1' }).jsonapi
        );
        await service.create(
          `http://example.com/api/realms/second-ephemeral-realm`,
          cardDocument().withAutoAttributes({ csId: '2' }).jsonapi
        );
        await service.create(
          `http://example.com/api/realms/second-ephemeral-realm`,
          cardDocument().withAutoAttributes({
            csId: '1',
            csOriginalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
          }).jsonapi
        );
        await service.create(
          `http://example.com/api/realms/second-ephemeral-realm`,
          cardDocument().withAutoAttributes({
            csId: '2',
            csOriginalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
          }).jsonapi
        );
      });

      after(async function() {
        await env.destroy();
      });

      it('can filter by csRealm', async function() {
        let { cards } = await service.search({
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
        let { cards } = await service.search({
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
        let { cards } = await service.search({
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
        let { cards } = await service.search({
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

      it('rejects csFiles with slashes in filenames', async function() {
        let doc = cardDocument().jsonapi;
        doc.data.attributes!.csFiles = { 'bad/slash': '123' };
        try {
          await service.instantiate(doc, { csRealm: `${myOrigin}/api/realms/first-ephemeral-realm`, csId: '1' });
          throw new Error(`should not get here`);
        } catch (err) {
          expect(err.message).to.match(/filename bad\/slash in csFiles cannot contain a slash/);
        }
      });

      it('rejects csFiles with non-string file contents', async function() {
        let doc = cardDocument().jsonapi;
        doc.data.attributes!.csFiles = 42;
        try {
          await service.instantiate(doc, { csRealm: `${myOrigin}/api/realms/first-ephemeral-realm`, csId: '1' });
          throw new Error(`should not get here`);
        } catch (err) {
          expect(err.message).to.match(/csFiles must be an object/);
        }
      });

      it('rejects csFiles with a non-string file inside', async function() {
        let doc = cardDocument().jsonapi;
        doc.data.attributes!.csFiles = { outer: { bad: 123 } };
        try {
          await service.instantiate(doc, { csRealm: `${myOrigin}/api/realms/first-ephemeral-realm`, csId: '1' });
          throw new Error(`should not get here`);
        } catch (err) {
          expect(err.message).to.match(/invalid csFiles contents for file outer\/bad/);
        }
      });
    });

    describe('user fields', function() {
      let env: TestEnv;
      let service: ScopedCardService;
      let puppyCard: AddressableCard,
        puppyMemeCard: AddressableCard,
        puppyDankMemeCard: AddressableCard,
        mango: AddressableCard,
        vanGogh: AddressableCard,
        ringo: AddressableCard,
        noIdea: AddressableCard,
        cupcake: AddressableCard,
        disappointed: AddressableCard,
        ownerCardByRef: AddressableCard,
        ownerCardByVal: AddressableCard,
        onlyPuppyOwnerCardByRef: AddressableCard,
        onlyPuppyOwnerCardByVal: AddressableCard,
        mangosMommyByRef: AddressableCard,
        mangosMommyByVal: AddressableCard,
        mommyByRef: AddressableCard,
        daddyByRef: AddressableCard,
        mommyByVal: AddressableCard,
        daddyByVal: AddressableCard,
        puppyMemeOwner: AddressableCard,
        puppyDankMemeOwner: AddressableCard,
        allTypesOwner: AddressableCard;
      before(async function() {
        env = await createTestEnv();
        service = (await env.container.lookup('cards')).as(Session.EVERYONE);
        puppyCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('name', 'string-field')
            .withField('weightInPounds', 'integer-field')
            .withField('rating', 'integer-field')
            .withField('birthday', 'date-field')
            .withField('lastPoop', 'datetime-field')
            .withField('pottyTrained', 'boolean-field').jsonapi
        );
        vanGogh = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              csCreated: '2020-01-01T01:00:00Z',
              name: 'Van Gogh',
              weightInPounds: 55,
              rating: 11,
              birthday: '2016-11-19',
              lastPoop: '2020-02-27T06:00:00.000Z',
              pottyTrained: true,
            })
            .adoptingFrom(puppyCard).jsonapi
        );
        mango = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              csCreated: '2020-01-01T03:00:00Z',
              name: 'Mango',
              weightInPounds: 7,
              rating: 11,
              birthday: '2019-10-30',
              lastPoop: '2020-02-27T10:00:00.000Z',
              pottyTrained: false,
            })
            .adoptingFrom(puppyCard).jsonapi
        );
        ringo = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              csCreated: '2020-01-01T02:00:00Z',
              name: 'Ringo',
              weightInPounds: 60,
              rating: 11,
              birthday: '2000-06-01',
              lastPoop: '2012-12-31T14:00:00.000Z',
              pottyTrained: true,
            })
            .adoptingFrom(puppyCard).jsonapi
        );
        puppyMemeCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('meme', 'string-field')
            .adoptingFrom(puppyCard).jsonapi
        );
        noIdea = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              meme: `I have no idea what I'm doing`,
            })
            .adoptingFrom(puppyMemeCard).jsonapi
        );
        cupcake = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              meme: 'Cupcake dog with 1000 yard stare',
            })
            .adoptingFrom(puppyMemeCard).jsonapi
        );
        puppyDankMemeCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument().adoptingFrom(puppyMemeCard).jsonapi
        );
        disappointed = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              meme: 'Disappointed puppy face',
            })
            .adoptingFrom(puppyDankMemeCard).jsonapi
        );
        onlyPuppyOwnerCardByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('name', 'string-field')
            .withField('puppy', puppyCard).jsonapi
        );
        onlyPuppyOwnerCardByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('name', 'string-field')
            .withField('puppy', puppyCard).jsonapi
        );
        ownerCardByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('name', 'string-field')
            .withField('puppies', puppyCard, 'plural').jsonapi
        );
        ownerCardByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withField('name', 'string-field')
            .withField('puppies', puppyCard, 'plural').jsonapi
        );
        // foil for the onlyPuppyOwnerCardByVal tests
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Hassan',
              puppy: (await vanGogh.serializeAsJsonAPIDoc()).data,
            })
            .adoptingFrom(onlyPuppyOwnerCardByVal).jsonapi
        );
        mangosMommyByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Mariko',
              puppy: (await mango.serializeAsJsonAPIDoc()).data,
            })
            .adoptingFrom(onlyPuppyOwnerCardByVal).jsonapi
        );
        // foil for the onlyPuppyOwnerCardByRef tests
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({ name: 'Hassan' })
            .withRelationships({ puppy: vanGogh })
            .adoptingFrom(onlyPuppyOwnerCardByRef).jsonapi
        );
        mangosMommyByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({ name: 'Mariko' })
            .withRelationships({ puppy: mango })
            .adoptingFrom(onlyPuppyOwnerCardByRef).jsonapi
        );
        mommyByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({ name: 'Mariko' })
            .withRelationships({ puppies: [vanGogh, mango] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        daddyByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({ name: 'Hassan' })
            .withRelationships({ puppies: [vanGogh, mango] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        // foil for the ownerCardByRef tests
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({ name: 'Dog Heaven' })
            .withRelationships({ puppies: [ringo] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        mommyByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Mariko',
              puppies: [(await vanGogh.serializeAsJsonAPIDoc()).data, (await mango.serializeAsJsonAPIDoc()).data],
            })
            .adoptingFrom(ownerCardByVal).jsonapi
        );
        daddyByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Hassan',
              puppies: [(await vanGogh.serializeAsJsonAPIDoc()).data, (await mango.serializeAsJsonAPIDoc()).data],
            })
            .adoptingFrom(ownerCardByVal).jsonapi
        );
        // foil for the ownerCardByVal tests
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withAttributes({
              name: 'Dog Heaven',
              puppies: [(await ringo.serializeAsJsonAPIDoc()).data],
            })
            .adoptingFrom(ownerCardByVal).jsonapi
        );
        puppyMemeOwner = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withRelationships({ puppies: [noIdea] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        puppyDankMemeOwner = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withRelationships({ puppies: [disappointed] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        allTypesOwner = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          cardDocument()
            .withRelationships({ puppies: [noIdea, ringo, disappointed] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
      });

      after(async function() {
        await env.destroy();
      });

      it("a field card can indicate if it is the enclosing card's own field or if it is adopted", async function() {
        let card = await service.get(puppyMemeCard);
        let field = await card.field('meme');
        expect(field.isAdopted).to.equal(false);

        field = await card.field('name');
        expect(field.isAdopted).to.equal(true);
      });

      it('a field card can return the source card in the adoption chain that defined the field', async function() {
        let card = await service.get(cupcake);
        let field = await card.field('name');

        expect(field.sourceCard?.canonicalURL).to.equal(puppyCard.canonicalURL);
      });

      it('a field card can return the enclosing card which is the card that has defined a value for the field', async function() {
        let card = await service.get(cupcake);
        let field = await card.field('name');

        expect(field.enclosingCard?.canonicalURL).to.equal(card.canonicalURL);
      });

      it('can equality filter by string user field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            eq: {
              name: 'Mango',
            },
          },
        });
        expect(results.cards.length).to.equal(1);
        expect(results.cards[0].canonicalURL).to.equal(mango.canonicalURL);
      });

      it('can equality filter by integer user field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            eq: {
              weightInPounds: 55,
            },
          },
        });
        expect(results.cards.length).to.equal(1);
        expect(results.cards[0].canonicalURL).to.equal(vanGogh.canonicalURL);
      });

      it('can equality filter by boolean user field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            eq: {
              pottyTrained: true,
            },
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([vanGogh.canonicalURL, ringo.canonicalURL]);

        results = await service.search({
          filter: {
            type: puppyCard,
            eq: {
              pottyTrained: false,
            },
          },
        });
        expect(results.cards.length).to.equal(1);
        expect(results.cards[0].canonicalURL).to.equal(mango.canonicalURL);
      });

      it('can use a range filter against an integer field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              weightInPounds: { gt: 50, lt: 70 },
            },
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([vanGogh.canonicalURL, ringo.canonicalURL]);
      });

      it('can use a range filter against a date field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              birthday: { lte: '2018-01-01' },
            },
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([ringo.canonicalURL, vanGogh.canonicalURL]);
      });

      it('can use a range filter against a datetime field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              lastPoop: { gt: '2020-02-27T00:00:00.000Z' },
            },
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([mango.canonicalURL, vanGogh.canonicalURL]);
      });

      it('can use a range filter against a string field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              name: { lte: 'Ringo' },
            },
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([mango.canonicalURL, ringo.canonicalURL]);
      });

      it('can use an "any" condition in a filter', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            any: [{ eq: { name: 'Van Gogh' } }, { eq: { name: 'Mango' } }],
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([vanGogh.canonicalURL, mango.canonicalURL]);
      });

      it('can use an "every" condition in a filter', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            every: [{ eq: { pottyTrained: true } }, { range: { weightInPounds: { gt: 40 } } }],
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([vanGogh.canonicalURL, ringo.canonicalURL]);
      });

      it('can use a "not" condition in a filter', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            not: { eq: { name: 'Ringo' } },
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([mango.canonicalURL, vanGogh.canonicalURL]);
      });

      it('can filter by the interior field of a field filled by a card as value', async function() {
        let results = await service.search({
          filter: {
            type: onlyPuppyOwnerCardByVal,
            eq: {
              'puppy.name': 'Mango',
            },
          },
        });
        expect(results.cards.length).to.equal(1);
        expect(results.cards[0].canonicalURL).to.equal(mangosMommyByVal.canonicalURL);
      });

      it('can filter by the interior field of a field filled by a referenced card', async function() {
        let results = await service.search({
          filter: {
            type: onlyPuppyOwnerCardByRef,
            eq: {
              'puppy.name': 'Mango',
            },
          },
        });
        expect(results.cards.length).to.equal(1);
        expect(results.cards[0].canonicalURL).to.equal(mangosMommyByRef.canonicalURL);
      });

      it('can filter by an interior csField of a field filled by a card', async function() {
        let results = await service.search({
          filter: {
            type: onlyPuppyOwnerCardByRef,
            eq: {
              'puppy.csId': mango.csId,
            },
          },
        });
        expect(results.cards.length).to.equal(1);
        expect(results.cards[0].canonicalURL).to.equal(mangosMommyByRef.canonicalURL);
      });

      it('filtering field filled by card references with arity > 1', async function() {
        let results = await service.search({
          filter: {
            type: ownerCardByRef,
            eq: {
              'puppies.name': 'Mango',
            },
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([mommyByRef.canonicalURL, daddyByRef.canonicalURL]);
      });

      it('filtering field filled by card values with arity > 1', async function() {
        let results = await service.search({
          filter: {
            type: ownerCardByVal,
            eq: {
              'puppies.name': 'Mango',
            },
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([mommyByVal.canonicalURL, daddyByVal.canonicalURL]);
      });

      it('filtering field by interior csField for a field with arity > 1', async function() {
        let results = await service.search({
          filter: {
            type: ownerCardByRef,
            eq: {
              'puppies.csId': mango.csId,
            },
          },
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([mommyByRef.canonicalURL, daddyByRef.canonicalURL]);
      });

      it('filtering solely by card type', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
          },
        });
        expect(results.cards.length).to.equal(8);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([
          puppyMemeCard.canonicalURL,
          puppyDankMemeCard.canonicalURL,
          mango.canonicalURL,
          vanGogh.canonicalURL,
          ringo.canonicalURL,
          noIdea.canonicalURL,
          cupcake.canonicalURL,
          disappointed.canonicalURL,
        ]);
      });

      it('can get all cards in the index by filtering for the base card', async function() {
        let results = await service.search({
          filter: {
            type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' },
          },
          page: {
            size: 1000,
          },
        });
        expect(results.cards.length).to.equal(29);
      });

      it("filtering by interior card's csAdoptsFrom field", async function() {
        // testing with adoption heirarchy: puppyCard -> puppyMemeCard -> puppyDankMemeCard
        let results = await service.search({
          filter: {
            type: ownerCardByRef,
            eq: {
              'puppies.csAdoptsFrom': puppyMemeCard.canonicalURL,
            },
          },
        });

        expect(results.cards.length).to.equal(3);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([
          puppyMemeOwner.canonicalURL,
          puppyDankMemeOwner.canonicalURL,
          allTypesOwner.canonicalURL,
        ]);
      });

      it("filtering by enclosing card's csAdoptsFrom field", async function() {
        // testing with adoption heirarchy: puppyCard -> puppyMemeCard -> puppyDankMemeCard
        let results = await service.search({
          filter: {
            type: puppyCard,
            eq: {
              csAdoptsFrom: puppyMemeCard.canonicalURL,
            },
          },
        });

        expect(results.cards.length).to.equal(4);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([
          puppyDankMemeCard.canonicalURL,
          noIdea.canonicalURL,
          cupcake.canonicalURL,
          disappointed.canonicalURL,
        ]);
      });

      it("inverting a filter by enclosing card's csAdoptsFrom field", async function() {
        // testing with adoption heirarchy: puppyCard -> puppyMemeCard -> puppyDankMemeCard
        let results = await service.search({
          filter: {
            type: puppyCard,
            not: {
              eq: {
                csAdoptsFrom: puppyMemeCard.canonicalURL,
              },
            },
          },
        });

        expect(results.cards.length).to.equal(4);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.have.members([
          puppyMemeCard.canonicalURL, // because the puppy meme card doesn't adopt itself
          vanGogh.canonicalURL,
          ringo.canonicalURL,
          mango.canonicalURL,
        ]);
      });

      it.skip('TODO: prefix filtering', async function() {});
      it.skip('TODO: exists filtering', async function() {});

      it('can sort by integer field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              weightInPounds: { gt: 0 },
            },
          },
          sort: 'weightInPounds',
        });

        expect(results.cards.length).to.equal(3);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.eql([mango.canonicalURL, vanGogh.canonicalURL, ringo.canonicalURL]);
      });

      it('can sort by date field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              birthday: { gt: '2015-01-01' },
            },
          },
          sort: 'birthday',
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.eql([vanGogh.canonicalURL, mango.canonicalURL]);
      });

      it('can sort by datetime field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              lastPoop: { gt: '2020-02-27T00:00:00.000Z' },
            },
          },
          sort: '-lastPoop',
        });
        expect(results.cards.length).to.equal(2);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.eql([mango.canonicalURL, vanGogh.canonicalURL]);
      });

      it('can sort by string field', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              name: { gte: 'A' },
            },
          },
          sort: 'name',
        });

        expect(results.cards.length).to.equal(3);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.eql([mango.canonicalURL, ringo.canonicalURL, vanGogh.canonicalURL]);
      });

      it('can sort by csCreated', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              name: { gte: 'A' },
            },
          },
          sort: 'csCreated',
        });

        expect(results.cards.length).to.equal(3);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.eql([vanGogh.canonicalURL, ringo.canonicalURL, mango.canonicalURL]);
      });

      it('can compound sort', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              name: { gte: 'A' },
            },
          },
          sort: ['rating', 'name'],
        });

        expect(results.cards.length).to.equal(3);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.eql([mango.canonicalURL, ringo.canonicalURL, vanGogh.canonicalURL]);
      });

      it('can sort descending', async function() {
        let results = await service.search({
          filter: {
            type: puppyCard,
            range: {
              name: { gte: 'A' },
            },
          },
          sort: '-name',
        });

        expect(results.cards.length).to.equal(3);
        let ids = results.cards.map(i => i.canonicalURL);
        expect(ids).to.eql([vanGogh.canonicalURL, ringo.canonicalURL, mango.canonicalURL]);
      });
    });

    describe('occlusion tests', function() {
      let env: TestEnv;
      let service: ScopedCardService;
      let toyCard: AddressableCard,
        puppyCard: AddressableCard,
        dalmatianCard: AddressableCard,
        ownerCard: AddressableCard,
        daddy: AddressableCard,
        mommy: AddressableCard,
        mango: AddressableCard,
        vanGogh: AddressableCard,
        squeakySnake: AddressableCard,
        personCard: AddressableCard,
        friendCard: AddressableCard,
        personA: AddressableCard,
        personB: AddressableCard,
        personC: AddressableCard,
        personD: AddressableCard,
        personE: AddressableCard,
        personF: AddressableCard,
        personG: AddressableCard,
        personH: AddressableCard;

      before(async function() {
        env = await createTestEnv();
        service = (await env.container.lookup('cards')).as(Session.EVERYONE);
        let csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;

        personCard = await service.create(csRealm, cardDocument().withField('name', 'string-field').jsonapi);

        friendCard = await service.create(
          csRealm,
          cardDocument()
            .withField('name', 'string-field')
            .withField('friends', personCard, 'plural')
            .withField('bestFriend', personCard)
            .adoptingFrom(personCard).jsonapi
        );

        personA = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({ name: 'Person A' })
            .adoptingFrom(friendCard).jsonapi
        );

        personB = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({ name: 'Person B' })
            .withRelationships({ bestFriend: personA })
            .adoptingFrom(friendCard).jsonapi
        );

        personA = await service.update(personA, {
          data: {
            type: 'cards',
            relationships: {
              bestFriend: { data: { type: 'cards', id: personB.canonicalURL } },
            },
          },
        });

        personC = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({ name: 'Person C' })
            .adoptingFrom(friendCard).jsonapi
        );

        personD = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({ name: 'Person D' })
            .withRelationships({ friends: [personA, personB, personC] })
            .adoptingFrom(friendCard).jsonapi
        );

        personC = await service.update(personC, {
          data: {
            type: 'cards',
            relationships: {
              friends: {
                data: [
                  { type: 'cards', id: personA.canonicalURL },
                  { type: 'cards', id: personB.canonicalURL },
                  { type: 'cards', id: personD.canonicalURL },
                ],
              },
            },
          },
        });

        personE = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({ name: 'Person E' })
            .adoptingFrom(friendCard).jsonapi
        );

        personF = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({ name: 'Person F' })
            .adoptingFrom(friendCard).jsonapi
        );

        personG = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({ name: 'Person G' })
            .withRelationships({ bestFriend: personF })
            .adoptingFrom(friendCard).jsonapi
        );

        personF = await service.update(personF, {
          data: {
            type: 'cards',
            relationships: {
              bestFriend: { data: { type: 'cards', id: personG.canonicalURL } },
            },
          },
        });

        personE = await service.update(personE, {
          data: {
            type: 'cards',
            relationships: {
              bestFriend: { data: { type: 'cards', id: personG.canonicalURL } },
            },
          },
        });

        personH = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({ name: 'Person H' })
            .adoptingFrom(friendCard).jsonapi
        );

        personH = await service.update(personH, {
          data: {
            type: 'cards',
            relationships: {
              bestFriend: { data: { type: 'cards', id: personH.canonicalURL } },
            },
          },
        });

        toyCard = await service.create(csRealm, cardDocument().withField('description', 'string-field').jsonapi);

        puppyCard = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({
              csFieldSets: {
                embedded: ['name'],
              },
            })
            .withField('name', 'string-field')
            .withField('favoriteToy', toyCard).jsonapi
        );

        dalmatianCard = await service.create(
          csRealm,
          cardDocument()
            .withField('numberOfSpots', 'integer-field')
            .adoptingFrom(puppyCard).jsonapi
        );

        ownerCard = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({
              csFieldSets: {
                isolated: ['name', 'puppies'],
                embedded: ['name'],
              },
            })
            .withField('name', 'string-field')
            .withField('puppies', puppyCard, 'plural').jsonapi
        );

        squeakySnake = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({
              description: 'a plush snake with squeaky segments',
            })
            .adoptingFrom(toyCard).jsonapi
        );

        vanGogh = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({
              name: 'Van Gogh',
              favoriteToy: cardDocument()
                .withAttributes({
                  description: 'a beef bone',
                })
                .adoptingFrom(toyCard).asCardValue,
            })
            .adoptingFrom(dalmatianCard).jsonapi
        );

        mango = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({
              name: 'Mango',
            })
            .withRelationships({ favoriteToy: squeakySnake })
            .adoptingFrom(dalmatianCard).jsonapi
        );

        daddy = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({
              name: 'Hassan',
            })
            .withRelationships({ puppies: [vanGogh, mango] })
            .adoptingFrom(ownerCard).jsonapi
        );
        mommy = await service.create(
          csRealm,
          cardDocument()
            .withAttributes({
              csFieldSets: {
                embedded: ['name'],
              },
              name: 'Mariko',
              puppies: [
                cardDocument()
                  .withAttributes({
                    csRealm,
                    csId: 'vangogh',
                    name: 'Van Gogh',
                    favoriteToy: cardDocument()
                      .withAttributes({
                        description: 'a beef bone',
                      })
                      .adoptingFrom(toyCard).asCardValue,
                  })
                  .adoptingFrom(dalmatianCard).asCardValue,
                cardDocument()
                  .withAttributes({
                    csRealm,
                    csId: 'mango',
                    name: 'Mango',
                  })
                  .withRelationships({ favoriteToy: squeakySnake })
                  .adoptingFrom(dalmatianCard).asCardValue,
              ],
            })
            .adoptingFrom(ownerCard).jsonapi
        );
      });

      after(async function() {
        await env.destroy();
      });

      it('can get all the field cards (including adopted fields)', async function() {
        let card = await service.get(mango);
        let fields = await card.fields();
        expect(fields.map(i => i.name)).to.have.members(['name', 'favoriteToy', 'numberOfSpots']);
      });

      it('can get all the field cards for a given set of occlusion rules', async function() {
        let card = await service.get(daddy);
        let fields = await card.fields({ includeFieldSet: 'embedded' });
        expect(fields.map(i => i.name)).to.have.members(['name']);
      });

      it('serializes the upstream doc', async function() {
        let { jsonapi: doc } = await daddy.asUpstreamDoc();
        expect(doc).to.have.nested.property('data.type', 'cards');
        expect(doc).to.have.nested.property('data.id', daddy.canonicalURL);
        expect(doc).to.have.nested.property('data.attributes.name', 'Hassan');
        expect(doc).to.have.deep.nested.property('data.relationships.puppies.data', [
          { type: 'cards', id: vanGogh.canonicalURL },
          { type: 'cards', id: mango.canonicalURL },
        ]);
      });

      it('recursively includes all resources and fields when getting the pristine doc if no rules are provided', async function() {
        let doc = await daddy.serializeAsJsonAPIDoc();

        expect(doc).to.have.nested.property('data.type', 'cards');
        expect(doc).to.have.nested.property('data.id', daddy.canonicalURL);
        expect(doc).to.have.nested.property('data.attributes.name', 'Hassan');
        expect(doc).to.have.deep.nested.property('data.relationships.puppies.data', [
          { type: 'cards', id: vanGogh.canonicalURL },
          { type: 'cards', id: mango.canonicalURL },
        ]);
        let included = doc.included as any[];

        expect(included.length).to.equal(8);
        let includedIds = included.map(i => i.id);
        expect(includedIds).to.have.members([
          // Note that all relationships are traversed including csField
          // relationships like csAdoptsFrom. These are the system field
          // relationships:
          canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }),
          toyCard.canonicalURL,
          puppyCard.canonicalURL,
          dalmatianCard.canonicalURL,
          ownerCard.canonicalURL,

          // user field relationships:
          squeakySnake.canonicalURL,
          vanGogh.canonicalURL,
          mango.canonicalURL,
        ]);

        let includedSqueakySnake = included.find(i => i.id === squeakySnake.canonicalURL);
        expect(includedSqueakySnake).to.have.nested.property(
          'attributes.description',
          'a plush snake with squeaky segments'
        );

        let includedVanGogh = included.find(i => i.id === vanGogh.canonicalURL);
        expect(includedVanGogh).to.have.nested.property('attributes.name', 'Van Gogh');
        expect(includedVanGogh).to.have.nested.property('attributes.favoriteToy.attributes.description', 'a beef bone');
        expect(includedVanGogh).to.have.deep.nested.property('attributes.favoriteToy.relationships.csAdoptsFrom.data', {
          type: 'cards',
          id: toyCard.canonicalURL,
        });

        let includedMango = included.find(i => i.id === mango.canonicalURL);
        expect(includedMango).to.have.nested.property('attributes.name', 'Mango');
        expect(includedMango).to.have.deep.nested.property('relationships.favoriteToy.data', {
          type: 'cards',
          id: squeakySnake.canonicalURL,
        });
      });

      it('can include a primitive field when getting the pristine doc', async function() {
        let doc = await vanGogh.serializeAsJsonAPIDoc({ includeFields: ['name'] });
        expect(doc).to.have.nested.property('data.attributes.name', 'Van Gogh');
        expect(doc).to.not.have.nested.property('data.attributes.favoriteToy');
        expect(doc).to.not.have.property('included');
      });

      it('can occlude all user fields when an empty rule "{}" is specified', async function() {
        let doc = await daddy.serializeAsJsonAPIDoc({});
        expect(doc).to.have.nested.property('data.type', 'cards');
        expect(doc).to.have.nested.property('data.id', daddy.canonicalURL);
        expect(doc).to.not.have.nested.property('data.attributes.name');
        expect(doc).to.not.have.nested.property('data.relationships.puppies');
        expect(doc).to.not.have.property('included');
      });

      it('does not occlude system fields as part of evaluating the occusion rules', async function() {
        let doc = await ownerCard.serializeAsJsonAPIDoc({});
        expect(doc.data.attributes?.csId).to.be.ok;
        expect(doc.data.attributes?.csRealm).to.ok;
        expect(doc.data.attributes?.csFields).to.be.ok;
        expect(doc.data.relationships?.csAdoptsFrom).to.be.ok;
      });

      // we will never omit the csAdoptsFrom in a card's relationships property
      // (see test above), but we can include a rule to include the adoptsFrom
      // resource in the resulting document.
      it('can include a csAdoptsFrom reference', async function() {
        let doc = await vanGogh.serializeAsJsonAPIDoc({ includeFields: ['csAdoptsFrom'] });
        expect(doc).to.not.have.nested.property('data.attributes.name', 'Van Gogh');
        expect(doc).to.not.have.nested.property('data.attributes.favoriteToy');
        let included = doc.included as any[];
        expect(included.length).to.equal(1);
        expect(included[0].id).to.equal(dalmatianCard.canonicalURL);
      });

      it('can include a field filled by card-as-value when getting the pristine doc', async function() {
        let doc = await vanGogh.serializeAsJsonAPIDoc({ includeFields: ['favoriteToy'] });
        expect(doc).to.not.have.nested.property('data.attributes.name');
        expect(doc).to.have.nested.property('data.attributes.favoriteToy');
        expect(doc).to.have.deep.nested.property('data.attributes.favoriteToy.relationships.csAdoptsFrom.data', {
          type: 'cards',
          id: toyCard.canonicalURL,
        });
        expect(doc).to.not.have.nested.property('data.attributes.favoriteToy.attributes.description');
        expect(doc).to.not.have.property('included');
      });

      it('can include a field filled by card-as-reference when getting the pristine doc', async function() {
        let doc = await mango.serializeAsJsonAPIDoc({ includeFields: ['favoriteToy'] });
        expect(doc).to.not.have.nested.property('data.attributes.name');
        expect(doc).to.have.deep.nested.property('data.relationships.favoriteToy.data', {
          type: 'cards',
          id: squeakySnake.canonicalURL,
        });
        let included = doc.included as any[];
        expect(included.length).to.equal(1);
        expect(included[0].id).to.equal(squeakySnake.canonicalURL);
        expect(included[0]).to.not.have.nested.property('attributes.description');
      });

      it('can include an interior card-as-value field when getting the pristine doc', async function() {
        let doc = await vanGogh.serializeAsJsonAPIDoc({
          includeFields: [{ name: 'favoriteToy', includeFields: ['description'] }],
        });
        expect(doc).to.not.have.nested.property('data.attributes.name');
        expect(doc).to.have.nested.property('data.attributes.favoriteToy');
        expect(doc).to.have.deep.nested.property('data.attributes.favoriteToy.relationships.csAdoptsFrom.data', {
          type: 'cards',
          id: toyCard.canonicalURL,
        });
        expect(doc).to.have.nested.property('data.attributes.favoriteToy.attributes.description', 'a beef bone');
        expect(doc).to.not.have.property('included');
      });

      it('can include an interior card-as-reference field when getting the pristine doc', async function() {
        let doc = await mango.serializeAsJsonAPIDoc({
          includeFields: [{ name: 'favoriteToy', includeFields: ['description'] }],
        });
        expect(doc).to.not.have.nested.property('data.attributes.name');
        expect(doc).to.have.deep.nested.property('data.relationships.favoriteToy.data', {
          type: 'cards',
          id: squeakySnake.canonicalURL,
        });
        let included = doc.included as any[];
        expect(included.length).to.equal(1);
        expect(included[0].id).to.equal(squeakySnake.canonicalURL);
        expect(included[0]).to.have.nested.property('attributes.description', 'a plush snake with squeaky segments');
      });

      it('can include an interior card-as-reference field from a field with arity > 1 when getting the pristine doc', async function() {
        let doc = await daddy.serializeAsJsonAPIDoc({
          includeFields: [
            {
              name: 'puppies',
              includeFields: [{ name: 'favoriteToy', includeFields: ['description'] }],
            },
          ],
        });
        expect(doc).to.not.have.nested.property('data.attributes.name');
        expect(doc).to.have.deep.nested.property('data.relationships.puppies.data', [
          { type: 'cards', id: vanGogh.canonicalURL },
          { type: 'cards', id: mango.canonicalURL },
        ]);

        let included = doc.included as any[];
        expect(included.length).to.equal(3);
        let ids = included.map(i => i.id);
        expect(ids).to.have.members([vanGogh.canonicalURL, mango.canonicalURL, squeakySnake.canonicalURL]);
        let includedVanGogh = included.find(i => i.id === vanGogh.canonicalURL);
        let includedMango = included.find(i => i.id === mango.canonicalURL);
        let includedSqueakySnake = included.find(i => i.id === squeakySnake.canonicalURL);

        expect(includedVanGogh).to.not.have.nested.property('attributes.name');
        expect(includedVanGogh).to.have.nested.property('attributes.favoriteToy');
        expect(includedVanGogh).to.have.deep.nested.property('attributes.favoriteToy.relationships.csAdoptsFrom.data', {
          type: 'cards',
          id: toyCard.canonicalURL,
        });
        expect(includedVanGogh).to.have.nested.property('attributes.favoriteToy.attributes.description', 'a beef bone');

        expect(includedMango).to.not.have.nested.property('attributes.name');
        expect(includedMango).to.have.deep.nested.property('relationships.favoriteToy.data', {
          type: 'cards',
          id: squeakySnake.canonicalURL,
        });

        expect(includedSqueakySnake).to.have.nested.property(
          'attributes.description',
          'a plush snake with squeaky segments'
        );
      });

      it('can include an interior card-as-value field from a field with arity > 1 when getting the pristine doc', async function() {
        let doc = await mommy.serializeAsJsonAPIDoc({
          includeFields: [
            {
              name: 'puppies',
              includeFields: [{ name: 'favoriteToy', includeFields: ['description'] }],
            },
          ],
        });
        expect(doc).to.not.have.nested.property('data.attributes.name');
        expect(doc).to.have.deep.nested.property('data.attributes.puppies');
        let puppies = doc.data?.attributes?.puppies as any[];
        expect(puppies.length).to.equal(2);
        let interiorVanGogh = puppies[0];
        let interiorMango = puppies[1];

        expect(interiorVanGogh).to.not.have.nested.property('attributes.name');
        expect(interiorVanGogh).to.have.nested.property('attributes.favoriteToy');
        expect(interiorVanGogh).to.have.deep.nested.property('attributes.favoriteToy.relationships.csAdoptsFrom.data', {
          type: 'cards',
          id: toyCard.canonicalURL,
        });
        expect(interiorVanGogh).to.have.nested.property('attributes.favoriteToy.attributes.description', 'a beef bone');

        expect(interiorMango).to.not.have.nested.property('attributes.name');
        expect(interiorMango).to.have.deep.nested.property('relationships.favoriteToy.data', {
          type: 'cards',
          id: squeakySnake.canonicalURL,
        });

        let included = doc.included as any[];
        expect(included.length).to.equal(1);
        expect(included[0]).to.have.nested.property('attributes.description', 'a plush snake with squeaky segments');
      });

      it('can include fields based on csFieldSets in a card', async function() {
        let doc = await daddy.serializeAsJsonAPIDoc({
          includeFieldSet: 'isolated',
        });
        expect(doc).to.have.nested.property('data.attributes.name');
        expect(doc).to.have.deep.nested.property('data.relationships.puppies.data', [
          { type: 'cards', id: vanGogh.canonicalURL },
          { type: 'cards', id: mango.canonicalURL },
        ]);

        let included = doc.included as any[];
        expect(included.length).to.equal(2);
        let ids = included.map(i => i.id);
        expect(ids).to.have.members([vanGogh.canonicalURL, mango.canonicalURL]);
        let includedVanGogh = included.find(i => i.id === vanGogh.canonicalURL);
        let includedMango = included.find(i => i.id === mango.canonicalURL);

        expect(includedVanGogh).to.have.nested.property('attributes.name');
        expect(includedVanGogh).to.not.have.nested.property('attributes.favoriteToy');

        expect(includedMango).to.have.nested.property('attributes.name');
        expect(includedVanGogh).to.not.have.nested.property('attributes.favoriteToy');
      });

      it('can include fields based on csFieldSets in a card and specified include fields', async function() {
        let doc = await daddy.serializeAsJsonAPIDoc({
          includeFieldSet: 'isolated',
          includeFields: [
            {
              name: 'puppies',
              includeFields: [
                'name',
                {
                  name: 'favoriteToy',
                  includeFields: ['description'],
                },
              ],
            },
          ],
        });
        expect(doc).to.have.nested.property('data.attributes.name');
        expect(doc).to.have.deep.nested.property('data.relationships.puppies.data', [
          { type: 'cards', id: vanGogh.canonicalURL },
          { type: 'cards', id: mango.canonicalURL },
        ]);

        let included = doc.included as any[];
        expect(included.length).to.equal(3);
        let ids = included.map(i => i.id);
        expect(ids).to.have.members([vanGogh.canonicalURL, mango.canonicalURL, squeakySnake.canonicalURL]);
        let includedVanGogh = included.find(i => i.id === vanGogh.canonicalURL);
        let includedMango = included.find(i => i.id === mango.canonicalURL);
        let includedSqueakySnake = included.find(i => i.id === squeakySnake.canonicalURL);

        expect(includedVanGogh).to.have.nested.property('attributes.name', 'Van Gogh');
        expect(includedVanGogh).to.have.nested.property('attributes.favoriteToy');
        expect(includedVanGogh).to.have.deep.nested.property('attributes.favoriteToy.relationships.csAdoptsFrom.data', {
          type: 'cards',
          id: toyCard.canonicalURL,
        });
        expect(includedVanGogh).to.have.nested.property('attributes.favoriteToy.attributes.description', 'a beef bone');

        expect(includedMango).to.have.nested.property('attributes.name', 'Mango');
        expect(includedMango).to.have.deep.nested.property('relationships.favoriteToy.data', {
          type: 'cards',
          id: squeakySnake.canonicalURL,
        });

        expect(includedSqueakySnake).to.have.nested.property(
          'attributes.description',
          'a plush snake with squeaky segments'
        );
      });

      it('can include fields based on csFieldSets that overrides inherited csFieldSets', async function() {
        let doc = await mommy.serializeAsJsonAPIDoc({
          includeFieldSet: 'embedded',
        });
        expect(doc).to.have.nested.property('data.attributes.name', 'Mariko');
        expect(doc).to.not.have.nested.property('data.attributes.puppies');
        expect(doc).to.not.have.property('included');
      });

      it('does not return user fields if the card does not have csFieldSet rules for the requested field-set', async function() {
        let doc = await squeakySnake.serializeAsJsonAPIDoc({
          includeFieldSet: 'embedded',
        });
        expect(doc).to.have.nested.property('data.type', 'cards');
        expect(doc).to.have.nested.property('data.id', squeakySnake.canonicalURL);
        expect(doc).to.not.have.nested.property('data.attributes.description');
      });

      it('can handle an included card that has a relationship to the primary card', async function() {
        let doc = await personA.serializeAsJsonAPIDoc();
        let included = doc.included as any[];
        expect(included.length).to.equal(4);
        let ids = included.map(i => i.id);
        expect(ids).to.have.members([
          canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }),
          personCard.canonicalURL,
          friendCard.canonicalURL,
          personB.canonicalURL,
        ]);
        let includedPersonB = included.find(i => i.id === personB.canonicalURL);
        expect(includedPersonB).to.have.deep.nested.property('relationships.bestFriend.data', {
          type: 'cards',
          id: personA.canonicalURL,
        });
      });

      it('can handle an included card that has a relationship to the primary card in arity > 1 field', async function() {
        let doc = await personC.serializeAsJsonAPIDoc();
        let included = doc.included as any[];
        expect(included.length).to.equal(6);
        let ids = included.map(i => i.id);
        expect(ids).to.have.members([
          canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }),
          personCard.canonicalURL,
          friendCard.canonicalURL,
          personA.canonicalURL,
          personB.canonicalURL,
          personD.canonicalURL,
        ]);
        let includedPersonD = included.find(i => i.id === personD.canonicalURL);
        expect(includedPersonD).to.have.deep.nested.property('relationships.friends.data', [
          { type: 'cards', id: personA.canonicalURL },
          { type: 'cards', id: personB.canonicalURL },
          { type: 'cards', id: personC.canonicalURL },
        ]);
      });

      it('can handle a cycle within the included cards', async function() {
        let doc = await personE.serializeAsJsonAPIDoc();
        let included = doc.included as any[];
        expect(included.length).to.equal(5);
        let ids = included.map(i => i.id);
        expect(ids).to.have.members([
          canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }),
          personCard.canonicalURL,
          friendCard.canonicalURL,
          personF.canonicalURL,
          personG.canonicalURL,
        ]);
        let includedPersonF = included.find(i => i.id === personF.canonicalURL);
        expect(includedPersonF).to.have.deep.nested.property('relationships.bestFriend.data', {
          type: 'cards',
          id: personG.canonicalURL,
        });
        let includedPersonG = included.find(i => i.id === personG.canonicalURL);
        expect(includedPersonG).to.have.deep.nested.property('relationships.bestFriend.data', {
          type: 'cards',
          id: personF.canonicalURL,
        });
      });

      it('can handle a primary card that is related to itself', async function() {
        let doc = await personH.serializeAsJsonAPIDoc();
        let included = doc.included as any[];
        expect(included.length).to.equal(3);
        let ids = included.map(i => i.id);
        expect(ids).to.have.members([
          canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }),
          personCard.canonicalURL,
          friendCard.canonicalURL,
        ]);
        expect(doc).to.have.deep.nested.property('data.relationships.bestFriend.data', {
          type: 'cards',
          id: personH.canonicalURL,
        });
      });
    });
  });
});
