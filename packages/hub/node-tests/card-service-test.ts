import { createTestEnv, TestEnv } from './helpers';
import { Session } from '../session';
import { myOrigin } from '../origin';
import { testCard } from './test-card';
import { ScopedCardService } from '../cards-service';
import { AddressableCard } from '../card';
import { CARDSTACK_PUBLIC_REALM } from '../realm';

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
      let doc = testCard();
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card.csRealm).to.equal(`${myOrigin}/api/realms/first-ephemeral-realm`);

      let foundCard = await service.get(card);
      expect(foundCard.canonicalURL).equals(card.canonicalURL);
    });

    it('can get a card out by canonical URL', async function() {
      let doc = testCard();
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let foundCard = await service.get(card.canonicalURL);
      expect(foundCard.canonicalURL).equals(card.canonicalURL);
    });

    it("adds upstream data source's version to the card's meta", async function() {
      let doc = testCard();
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect((await card.asPristineDoc()).jsonapi.data.meta?.version).to.be.ok;
    });

    it('can create a card that adopts from another', async function() {
      let base = testCard();
      let baseCard = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, base.jsonapi);

      let doc = testCard()
        .withAutoAttributes({ goodbye: 'world' })
        .adoptingFrom(baseCard);
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      let parent = await card.adoptsFrom();
      expect(parent?.canonicalURL).to.equal(baseCard.canonicalURL);
    });

    it('can update a card', async function() {
      let doc = testCard().withAutoAttributes({ foo: 'bar' });
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
      let doc = testCard().withAutoAttributes({ foo: 'bar' });
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);

      let jsonapi = (await card.asPristineDoc()).jsonapi;
      jsonapi.data.attributes!.foo = 'poo';
      card = await service.update(card.canonicalURL, jsonapi);

      expect(await card.value('foo')).to.equal('poo');
    });

    it('can update a card with a patch', async function() {
      let doc = testCard().withAutoAttributes({ foo: 'bar', hello: 'world' });
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);

      let jsonapi = (await card.asPristineDoc()).jsonapi;
      jsonapi.data.attributes!.foo = 'poo';
      delete jsonapi.data.attributes!.hello;

      card = await service.update(card, jsonapi);

      expect(await card.value('foo')).to.equal('poo');
      expect(await card.value('hello')).to.equal('world');
    });

    it('it does not update a card that uses ephemeral storage when the meta.version is missing', async function() {
      let doc = testCard().withAutoAttributes({ foo: 'bar' });
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

    it('can search by user-defined field', async function() {
      let post = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard().withField('title', 'string-field').jsonapi
      );
      let matchingPost = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard()
          .withAttributes({ title: 'hello' })
          .adoptingFrom(post).jsonapi
      );
      await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard()
          .withAttributes({ title: 'goodbye' })
          .adoptingFrom(post).jsonapi
      );
      // deliberately unrelated card which happens to use the same field name
      await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard().withAutoAttributes({ title: 'hello', iAmUnrelated: true }).jsonapi
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
      let doc = testCard().withAttributes({ badField: 'hello' });

      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/no such field "badField"/);
      }
    });

    it('rejects unknown relationship at create', async function() {
      let doc = testCard().withRelationships({
        badField: testCard().withAutoAttributes({ csRealm: 'x', csId: 'y' }),
      });

      try {
        await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
        throw new Error(`should not have been able to create`);
      } catch (err) {
        expect(err).hasStatus(400);
        expect(err.detail).to.match(/no such field "badField"/);
      }
    });

    it('applies string field type validation at create', async function() {
      let doc = testCard()
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

      doc = testCard()
        .withAttributes({
          title: 'test',
        })
        .withField('title', 'string-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card).is.ok;
      expect(await card.value('title')).to.equal('test');
    });

    it('applies boolean field type validation at create', async function() {
      let doc = testCard()
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
      doc = testCard()
        .withAttributes({
          isCool: true,
        })
        .withField('isCool', 'boolean-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card).is.ok;
      expect(await card.value('isCool')).to.equal(true);
    });

    it('applies integer field type validation at create', async function() {
      let doc = testCard()
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
      doc = testCard()
        .withAttributes({
          puppyCount: 42,
        })
        .withField('puppyCount', 'integer-field');
      let card = await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
      expect(card).is.ok;
      expect(await card.value('puppyCount')).to.equal(42);
    });

    it('applies string field type validation during update', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard().withField('title', 'string-field').jsonapi
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
        testCard().withField('isCool', 'boolean-field').jsonapi
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

    it('applies integer field type validation during update', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard().withField('puppyCount', 'integer-field').jsonapi
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

    describe('fields filled with cards', function() {
      let addressCard: AddressableCard, userCard: AddressableCard;

      beforeEach(async function() {
        addressCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withField('streetAddress', 'string-field')
            .withField('city', 'string-field')
            .withField('state', 'string-field')
            .withField('zip', 'string-field').jsonapi
        );
        userCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withField('name', 'string-field')
            .withField('address', addressCard).jsonapi
        );
      });

      it('can set a composite field in a card as card value', async function() {
        let validUser = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Mango',
              address: testCard().withAttributes({
                streetAddress: '123 Bone St.',
                city: 'Barkyville',
                state: 'MA',
                zip: '01234',
              }).jsonapi.data, // not specifying adoptingFrom(), since that is inferred from the field definition
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
          testCard()
            .withAttributes({
              name: 'Mango',
              address: testCard().withAttributes({
                streetAddress: '123 Bone St.',
                city: 'Barkyville',
                state: 'MA',
                zip: '01234',
              }).jsonapi.data,
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

      it('applies field type validation to interior field of composite field', async function() {
        let doc = testCard()
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

      it('rejects composite field value with unknown interior field', async function() {
        let doc = testCard()
          .withAttributes({
            name: 'Mango',
            address: {
              attributes: {
                badField: 'this is not a valid field',
              },
            },
          })
          .adoptingFrom(userCard);

        try {
          await service.create(`${myOrigin}/api/realms/first-ephemeral-realm`, doc.jsonapi);
          throw new Error(`should not have been able to create`);
        } catch (err) {
          expect(err).hasStatus(400);
          expect(err.detail).to.match(/no such field "badField"/);
        }
      });

      it('can set a field with a card reference', async function() {
        let homeAddress = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
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
          testCard()
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
          testCard()
            .withField('streetAddress', 'string-field')
            .withField('city', 'string-field')
            .withField('state', 'string-field')
            .withField('zip', 'string-field').jsonapi
        );
        let notActuallyAnAddress = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              streetAddress: '123 Bone St.',
              city: 'Barkyville',
              state: 'MA',
              zip: '01234',
            })
            .adoptingFrom(nonAddressCard).jsonapi
        );

        let doc = testCard()
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

      it.skip('rejects a card reference that is not the correct arity', async function() {});
      it.skip('rejects a card value that is not the correct arity', async function() {});
      it.skip('rejects a specific card value when validating a field that has arity > 1', async function() {});

      it('can break a cycle in the search doc', async function() {
        let friendCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withField('friend', userCard)
            .adoptingFrom(userCard).jsonapi
        );
        let user1 = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Deandra',
            })
            .adoptingFrom(friendCard).jsonapi
        );
        let user2 = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Alice',
            })
            .withRelationships({ friend: user1 })
            .adoptingFrom(friendCard).jsonapi
        );
        let user3 = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
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
        expect(searchDoc).to.have.deep.property(`csId`, user1.csId);
        expect(searchDoc).to.have.deep.property(`${friendField}.csId`, user3.csId);
        expect(searchDoc).to.have.deep.property(`${friendField}.${friendField}.csId`, user2.csId);
        expect(searchDoc).to.not.have.deep.property(`${friendField}.${friendField}.${friendField}`);
      });
    });
  });

  describe('readonly', function() {
    let env: TestEnv;
    let service: ScopedCardService;

    before(async function() {
      env = await createTestEnv();
      service = (await env.container.lookup('cards')).as(Session.EVERYONE);
    });

    after(async function() {
      await env.destroy();
    });

    describe('system fields', function() {
      before(async function() {
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard().withAutoAttributes({ csId: '1' }).jsonapi
        );
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard().withAutoAttributes({ csId: '2' }).jsonapi
        );
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard().withAutoAttributes({
            csId: '1',
            csOriginalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
          }).jsonapi
        );
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard().withAutoAttributes({
            csId: '2',
            csOriginalRealm: `http://example.com/api/realms/second-ephemeral-realm`,
          }).jsonapi
        );
        await service.create(
          `http://example.com/api/realms/second-ephemeral-realm`,
          testCard().withAutoAttributes({ csId: '1' }).jsonapi
        );
        await service.create(
          `http://example.com/api/realms/second-ephemeral-realm`,
          testCard().withAutoAttributes({ csId: '2' }).jsonapi
        );
        await service.create(
          `http://example.com/api/realms/second-ephemeral-realm`,
          testCard().withAutoAttributes({
            csId: '1',
            csOriginalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
          }).jsonapi
        );
        await service.create(
          `http://example.com/api/realms/second-ephemeral-realm`,
          testCard().withAutoAttributes({
            csId: '2',
            csOriginalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`,
          }).jsonapi
        );
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
        let doc = testCard().jsonapi;
        doc.data.attributes!.csFiles = { 'bad/slash': '123' };
        try {
          await service.instantiate(doc, { csRealm: `${myOrigin}/api/realms/first-ephemeral-realm`, csId: '1' });
          throw new Error(`should not get here`);
        } catch (err) {
          expect(err.message).to.match(/filename bad\/slash in csFiles cannot contain a slash/);
        }
      });

      it('rejects csFiles with non-string file contents', async function() {
        let doc = testCard().jsonapi;
        doc.data.attributes!.csFiles = 42;
        try {
          await service.instantiate(doc, { csRealm: `${myOrigin}/api/realms/first-ephemeral-realm`, csId: '1' });
          throw new Error(`should not get here`);
        } catch (err) {
          expect(err.message).to.match(/csFiles must be an object/);
        }
      });

      it('rejects csFiles with a non-string file inside', async function() {
        let doc = testCard().jsonapi;
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
        puppyCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withField('name', 'string-field')
            .withField('weightInPounds', 'integer-field')
            .withField('rating', 'integer-field')
            .withField('pottyTrained', 'boolean-field').jsonapi
        );
        vanGogh = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Van Gogh',
              weightInPounds: 55,
              rating: 11,
              pottyTrained: true,
            })
            .adoptingFrom(puppyCard).jsonapi
        );
        mango = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Mango',
              weightInPounds: 7,
              rating: 11,
              pottyTrained: false,
            })
            .adoptingFrom(puppyCard).jsonapi
        );
        ringo = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Ringo',
              weightInPounds: 60,
              rating: 11,
              pottyTrained: true,
            })
            .adoptingFrom(puppyCard).jsonapi
        );
        puppyMemeCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withField('meme', 'string-field')
            .adoptingFrom(puppyCard).jsonapi
        );
        noIdea = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              meme: `I have no idea what I'm doing`,
            })
            .adoptingFrom(puppyMemeCard).jsonapi
        );
        cupcake = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              meme: 'Cupcake dog with 1000 yard stare',
            })
            .adoptingFrom(puppyMemeCard).jsonapi
        );
        puppyDankMemeCard = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard().adoptingFrom(puppyMemeCard).jsonapi
        );
        disappointed = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              meme: 'Disappointed puppy face',
            })
            .adoptingFrom(puppyDankMemeCard).jsonapi
        );
        onlyPuppyOwnerCardByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withField('name', 'string-field')
            .withField('puppy', puppyCard).jsonapi
        );
        onlyPuppyOwnerCardByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withField('name', 'string-field')
            .withField('puppy', puppyCard).jsonapi
        );
        ownerCardByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withField('name', 'string-field')
            .withField('puppies', puppyCard, 'plural').jsonapi
        );
        ownerCardByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withField('name', 'string-field')
            .withField('puppies', puppyCard, 'plural').jsonapi
        );
        // foil for the onlyPuppyOwnerCardByVal tests
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Hassan',
              puppy: (await vanGogh.asPristineDoc()).jsonapi.data,
            })
            .adoptingFrom(onlyPuppyOwnerCardByVal).jsonapi
        );
        mangosMommyByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Mariko',
              puppy: (await mango.asPristineDoc()).jsonapi.data,
            })
            .adoptingFrom(onlyPuppyOwnerCardByVal).jsonapi
        );
        // foil for the onlyPuppyOwnerCardByRef tests
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({ name: 'Hassan' })
            .withRelationships({ puppy: vanGogh })
            .adoptingFrom(onlyPuppyOwnerCardByRef).jsonapi
        );
        mangosMommyByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({ name: 'Mariko' })
            .withRelationships({ puppy: mango })
            .adoptingFrom(onlyPuppyOwnerCardByRef).jsonapi
        );
        mommyByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({ name: 'Mariko' })
            .withRelationships({ puppies: [vanGogh, mango] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        daddyByRef = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({ name: 'Hassan' })
            .withRelationships({ puppies: [vanGogh, mango] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        // foil for the ownerCardByRef tests
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({ name: 'Dog Heaven' })
            .withRelationships({ puppies: [ringo] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        mommyByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Mariko',
              puppies: [(await vanGogh.asPristineDoc()).jsonapi.data, (await mango.asPristineDoc()).jsonapi.data],
            })
            .adoptingFrom(ownerCardByVal).jsonapi
        );
        daddyByVal = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Hassan',
              puppies: [(await vanGogh.asPristineDoc()).jsonapi.data, (await mango.asPristineDoc()).jsonapi.data],
            })
            .adoptingFrom(ownerCardByVal).jsonapi
        );
        // foil for the ownerCardByVal tests
        await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withAttributes({
              name: 'Dog Heaven',
              puppies: [(await ringo.asPristineDoc()).jsonapi.data],
            })
            .adoptingFrom(ownerCardByVal).jsonapi
        );
        puppyMemeOwner = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withRelationships({ puppies: [noIdea] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        puppyDankMemeOwner = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withRelationships({ puppies: [disappointed] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
        allTypesOwner = await service.create(
          `${myOrigin}/api/realms/first-ephemeral-realm`,
          testCard()
            .withRelationships({ puppies: [noIdea, ringo, disappointed] })
            .adoptingFrom(ownerCardByRef).jsonapi
        );
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

      it('nested filter with a leaf filter that filters against card type', async function() {
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
  });

  // separating this out of the read-only so that we have a clean container for the test
  describe('filter by base card', function() {
    let env: TestEnv, service: ScopedCardService;
    let puppyCard: AddressableCard, mango: AddressableCard, vanGogh: AddressableCard, ringo: AddressableCard;

    beforeEach(async function() {
      env = await createTestEnv();
      service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      puppyCard = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard()
          .withField('name', 'string-field')
          .withField('weightInPounds', 'integer-field')
          .withField('pottyTrained', 'boolean-field').jsonapi
      );
      vanGogh = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard()
          .withAttributes({
            name: 'Van Gogh',
            weightInPounds: 55,
            pottyTrained: true,
          })
          .adoptingFrom(puppyCard).jsonapi
      );
      mango = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard()
          .withAttributes({
            name: 'Mango',
            weightInPounds: 7,
            pottyTrained: false,
          })
          .adoptingFrom(puppyCard).jsonapi
      );
      ringo = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        testCard()
          .withAttributes({
            name: 'Ringo',
            weightInPounds: 60,
            pottyTrained: true,
          })
          .adoptingFrom(puppyCard).jsonapi
      );
    });

    afterEach(async function() {
      await env.destroy();
    });

    it('can get all cards in the index by filtering for the base card', async function() {
      let results = await service.search({
        filter: {
          type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' },
        },
      });

      expect(results.cards.length).to.equal(4);
      let ids = results.cards.map(i => i.canonicalURL);
      expect(ids).to.have.members([
        puppyCard.canonicalURL,
        mango.canonicalURL,
        vanGogh.canonicalURL,
        ringo.canonicalURL,
      ]);
    });
  });
});
