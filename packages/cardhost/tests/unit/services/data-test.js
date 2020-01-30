import { module, test } from 'qunit';
import { myOrigin } from '@cardstack/core/origin';
import { setupTest } from 'ember-qunit';
import { cardDocument } from '@cardstack/core/card-document';
import Fixtures from '../../helpers/fixtures';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { Card, AddressableCard, canonicalURL } from '@cardstack/core/card';
const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
module('Unit | Service | data', function () {
    module('non-mutating tests', function (hooks) {
        let toyCard = cardDocument()
            .withAttributes({
            csRealm,
            csId: 'toy-card',
        })
            .withField('description', 'string-field');
        let puppyCard = cardDocument()
            .withAttributes({
            csRealm,
            csId: 'puppy-card',
            csFieldSets: {
                embedded: ['name'],
            },
        })
            .withField('name', 'string-field')
            .withField('houseBroken', 'boolean-field')
            .withField('favoriteToy', toyCard);
        let dalmatianCard = cardDocument()
            .withAttributes({
            csRealm,
            csId: 'dalmatian-card',
        })
            .withField('numberOfSpots', 'integer-field')
            .adoptingFrom(puppyCard);
        let ownerCard = cardDocument()
            .withAttributes({
            csRealm,
            csId: 'owner-card',
            csFieldSets: {
                isolated: ['name', 'puppies'],
            },
        })
            .withField('name', 'string-field')
            .withField('puppies', puppyCard, 'plural');
        let squeakySnake = cardDocument()
            .withAttributes({
            csRealm,
            csId: 'squeaky-snake',
            description: 'a plush snake with squeaky segments',
        })
            .adoptingFrom(toyCard);
        let vanGogh = cardDocument()
            .withAttributes({
            csRealm,
            csId: 'vangogh',
            name: 'Van Gogh',
            numberOfSpots: 150,
            houseBroken: true,
            favoriteToy: cardDocument()
                .withAttributes({
                description: 'a beef bone',
            })
                .adoptingFrom(toyCard).asCardValue,
        })
            .adoptingFrom(dalmatianCard);
        let mango = cardDocument()
            .withAttributes({
            csRealm,
            csId: 'mango',
            name: 'Mango',
            numberOfSpots: 100,
            houseBroken: false,
        })
            .withRelationships({ favoriteToy: squeakySnake })
            .adoptingFrom(dalmatianCard);
        let daddy = cardDocument()
            .withAttributes({
            csRealm,
            csId: 'hassan',
            name: 'Hassan',
        })
            .withRelationships({ puppies: [vanGogh, mango] })
            .adoptingFrom(ownerCard);
        let mommy = cardDocument()
            .withAttributes({
            csRealm,
            csId: 'mariko',
            csFieldSets: {
                embedded: ['name'],
            },
            name: 'Mariko',
            puppies: [vanGogh.asCardValue, mango.asCardValue],
        })
            .adoptingFrom(ownerCard);
        const scenario = new Fixtures({
            // Note that order doesn't matter--the Fixtures class will figure out all
            // the cards' dependencies and create/destroy the cards in the correct
            // order.
            create: [daddy, mommy, toyCard, puppyCard, dalmatianCard, ownerCard, squeakySnake, vanGogh, mango],
        });
        setupTest(hooks);
        scenario.setupModule(hooks);
        test('it can get a card by id', async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.load(mango, 'everything');
            assert.equal(card.csId, mango.csId, 'the csId is correct');
            assert.equal(card.csRealm, mango.csRealm, 'the csRealm is correct');
            assert.equal(card.csOriginalRealm, card.csRealm, 'the csOriginalRealm is correct');
        });
        test('it can search for cards', async function (assert) {
            let service = this.owner.lookup('service:data');
            let foundCards = await service.search({
                filter: {
                    type: puppyCard,
                    eq: {
                        name: 'Mango',
                    },
                },
            }, 'everything');
            assert.equal(foundCards.length, 1, 'the correct number of cards is returned');
            assert.equal(foundCards[0].canonicalURL, mango.canonicalURL, 'the correct card is found');
        });
        test("it can get a value of a card's primitive fields", async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.load(vanGogh, 'everything');
            assert.equal(await card.value('name'), 'Van Gogh', 'the user-field value is correct');
            assert.equal(await card.value('numberOfSpots'), 150, 'the user-field value is correct');
            assert.equal(await card.value('houseBroken'), true, 'the user-field value is correct');
        });
        test('it can get a card-as-value value of a card field', async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.load(vanGogh, 'everything');
            let toy = await card.value('favoriteToy');
            assert.ok(toy instanceof Card, 'user-field value deserialized correctly');
            assert.notOk(toy instanceof AddressableCard, 'user-field value deserialized correctly');
            assert.equal(await toy.value('description'), 'a beef bone', 'user-field value is correct');
        });
        test('it can get a card-as-reference value of a card field', async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.load(mango, 'everything');
            let toy = await card.value('favoriteToy');
            assert.ok(toy instanceof AddressableCard, 'user-field value deserialized correctly');
            assert.equal(await toy.value('description'), 'a plush snake with squeaky segments', 'user-field value deserialized correctly');
        });
        test('it can get a card-as-value value of a card artity > 1 field', async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.load(mommy, 'everything');
            let puppies = await card.value('puppies');
            assert.equal(puppies.length, 2, 'arity of user-field value is correct');
            assert.ok(puppies.every(i => i instanceof Card), 'user-field values deserialized correctly');
            assert.ok(puppies.every(i => !(i instanceof AddressableCard)), 'user-field values deserialized correctly');
            assert.equal(await puppies[0].value('name'), 'Van Gogh', 'the user-field value is correct');
            assert.equal(await puppies[1].value('name'), 'Mango', 'the user-field value is correct');
        });
        test('it can get a card-as-reference value of a card artity > 1 field', async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.load(daddy, 'everything');
            let puppies = await card.value('puppies');
            assert.equal(puppies.length, 2, 'arity of user-field value is correct');
            assert.ok(puppies.every(i => i instanceof AddressableCard), 'user-field values deserialized correctly');
            assert.equal(await puppies[0].value('name'), 'Van Gogh', 'the user-field value is correct');
            assert.equal(await puppies[1].value('name'), 'Mango', 'the user-field value is correct');
        });
        test('it can get a card with fully expanded pristine doc', async function (assert) {
            var _a, _b;
            let service = this.owner.lookup('service:data');
            let card = await service.load(daddy, 'everything');
            let doc = await card.serializeAsJsonAPIDoc('everything');
            assert.equal(doc.data.type, 'cards');
            assert.equal(doc.data.id, daddy.canonicalURL);
            assert.equal((_a = doc.data.attributes) === null || _a === void 0 ? void 0 : _a.name, 'Hassan');
            assert.deepEqual(((_b = doc.data.relationships) === null || _b === void 0 ? void 0 : _b.puppies).data, [
                { type: 'cards', id: vanGogh.canonicalURL },
                { type: 'cards', id: mango.canonicalURL },
            ]);
            let included = doc.included;
            assert.equal(included.length, 8);
            let includedIds = included.map(i => i.id);
            assert.deepEqual(includedIds.sort(), [
                dalmatianCard.canonicalURL,
                mango.canonicalURL,
                ownerCard.canonicalURL,
                puppyCard.canonicalURL,
                squeakySnake.canonicalURL,
                toyCard.canonicalURL,
                vanGogh.canonicalURL,
                canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }),
            ]);
            let includedSqueakySnake = included.find(i => i.id === squeakySnake.canonicalURL);
            assert.equal(includedSqueakySnake.attributes.description, 'a plush snake with squeaky segments');
            let includedVanGogh = included.find(i => i.id === vanGogh.canonicalURL);
            assert.equal(includedVanGogh.attributes.name, 'Van Gogh');
            assert.equal(includedVanGogh.attributes.favoriteToy.attributes.description, 'a beef bone');
            assert.deepEqual(includedVanGogh.attributes.favoriteToy.relationships.csAdoptsFrom.data, {
                type: 'cards',
                id: toyCard.canonicalURL,
            });
            let includedMango = included.find(i => i.id === mango.canonicalURL);
            assert.equal(includedMango.attributes.name, 'Mango');
            assert.deepEqual(includedMango.relationships.favoriteToy.data, {
                type: 'cards',
                id: squeakySnake.canonicalURL,
            });
        });
        test('it can get a card with isolated fieldset format', async function (assert) {
            var _a, _b;
            let service = this.owner.lookup('service:data');
            let card = await service.load(daddy, 'everything');
            let doc = await card.serializeAsJsonAPIDoc({
                includeFieldSet: 'isolated',
            });
            assert.ok((_a = doc.data.attributes) === null || _a === void 0 ? void 0 : _a.name);
            assert.deepEqual(((_b = doc.data.relationships) === null || _b === void 0 ? void 0 : _b.puppies).data, [
                { type: 'cards', id: vanGogh.canonicalURL },
                { type: 'cards', id: mango.canonicalURL },
            ]);
            let included = doc.included;
            assert.equal(included.length, 2);
            let ids = included.map(i => i.id);
            assert.deepEqual(ids.sort(), [mango.canonicalURL, vanGogh.canonicalURL]);
            let includedVanGogh = included.find(i => i.id === vanGogh.canonicalURL);
            let includedMango = included.find(i => i.id === mango.canonicalURL);
            assert.ok(includedVanGogh.attributes.name);
            assert.notOk(includedVanGogh.attributes.favoriteToy);
            assert.ok(includedMango.attributes.name);
            assert.notOk(includedVanGogh.attributes.favoriteToy);
        });
        test('it can get a card with embedded fieldset format', async function (assert) {
            var _a, _b;
            let service = this.owner.lookup('service:data');
            let card = await service.load(mommy, 'everything');
            let doc = await card.serializeAsJsonAPIDoc({
                includeFieldSet: 'embedded',
            });
            assert.ok((_a = doc.data.attributes) === null || _a === void 0 ? void 0 : _a.name, 'Mariko');
            assert.notOk((_b = doc.data.attributes) === null || _b === void 0 ? void 0 : _b.puppies);
            assert.notOk(doc.included);
        });
        test('it can get a card with specific field includes', async function (assert) {
            var _a, _b;
            let service = this.owner.lookup('service:data');
            let card = await service.load(vanGogh, 'everything');
            let doc = await card.serializeAsJsonAPIDoc({ includeFields: ['name'] });
            assert.equal((_a = doc.data.attributes) === null || _a === void 0 ? void 0 : _a.name, 'Van Gogh');
            assert.notOk((_b = doc.data.attributes) === null || _b === void 0 ? void 0 : _b.favoriteToy);
            assert.notOk(doc.included);
        });
        test('it can get a card with an isolated field set and specified field includes', async function (assert) {
            var _a, _b, _c;
            let service = this.owner.lookup('service:data');
            let card = await service.load(daddy, 'everything');
            let doc = await card.serializeAsJsonAPIDoc({
                includeFieldSet: 'isolated',
                includeFields: [
                    {
                        name: 'puppies',
                        includeFields: [
                            {
                                name: 'favoriteToy',
                                includeFields: ['description'],
                            },
                        ],
                    },
                ],
            });
            assert.ok((_a = doc.data.attributes) === null || _a === void 0 ? void 0 : _a.name);
            assert.deepEqual(((_b = doc.data.relationships) === null || _b === void 0 ? void 0 : _b.puppies).data, [
                { type: 'cards', id: vanGogh.canonicalURL },
                { type: 'cards', id: mango.canonicalURL },
            ]);
            let included = doc.included;
            assert.equal(included.length, 3);
            let ids = included.map(i => i.id);
            assert.deepEqual(ids.sort(), [mango.canonicalURL, squeakySnake.canonicalURL, vanGogh.canonicalURL]);
            let includedVanGogh = included.find(i => i.id === vanGogh.canonicalURL);
            let includedMango = included.find(i => i.id === mango.canonicalURL);
            let includedSqueakySnake = included.find(i => i.id === squeakySnake.canonicalURL);
            assert.equal((_c = includedVanGogh.attributes) === null || _c === void 0 ? void 0 : _c.name, 'Van Gogh');
            assert.ok(includedVanGogh.attributes.favoriteToy);
            assert.deepEqual(includedVanGogh.attributes.favoriteToy.relationships.csAdoptsFrom.data, {
                type: 'cards',
                id: toyCard.canonicalURL,
            });
            assert.equal(includedVanGogh.attributes.favoriteToy.attributes.description, 'a beef bone');
            assert.equal(includedMango.attributes.name, 'Mango');
            assert.deepEqual(includedMango.relationships.favoriteToy.data, {
                type: 'cards',
                id: squeakySnake.canonicalURL,
            });
            assert.equal(includedSqueakySnake.attributes.description, 'a plush snake with squeaky segments');
        });
    });
    module('mutating tests', function (hooks) {
        const scenario = new Fixtures({
            destroy: {
                cardTypes: [{ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }],
            },
        });
        setupTest(hooks);
        scenario.setupTest(hooks);
        test('it creates an UnsavedCard', async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.create(csRealm, cardDocument().withAutoAttributes({
                name: 'Van Gogh',
            }).jsonapi);
            assert.notOk(card.csId, 'the card csId does not exist');
            assert.equal(card.csRealm, csRealm, 'the card csRealm is correct');
            assert.equal(card.csOriginalRealm, csRealm, 'the card csOriginalRealm is correct');
            assert.equal(await card.value('name'), 'Van Gogh', 'the card user field value is correct');
        });
        test('it saves an UnsavedCard', async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.create(csRealm, cardDocument().withAutoAttributes({
                name: 'Van Gogh',
            }).jsonapi);
            let savedCard = await service.save(card);
            assert.ok(savedCard.csId, 'the card csId exists');
            assert.equal(savedCard.csRealm, csRealm, 'the card csRealm is correct');
            assert.equal(savedCard.csOriginalRealm, csRealm, 'the card csOriginalRealm is correct');
            assert.equal(await savedCard.value('name'), 'Van Gogh', 'the card user field value is correct');
            let retreivedCard = await service.load(savedCard, 'everything');
            assert.equal(retreivedCard.csId, savedCard.csId, 'the card csId isCorect');
            assert.equal(retreivedCard.csRealm, csRealm, 'the card csRealm is correct');
            assert.equal(retreivedCard.csOriginalRealm, csRealm, 'the card csOriginalRealm is correct');
            assert.equal(await retreivedCard.value('name'), 'Van Gogh', 'the card user field value is correct');
        });
        test('it patches a card', async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.create(csRealm, cardDocument().withAutoAttributes({
                name: 'Van Gogh',
                favoriteColor: 'teal',
            }).jsonapi);
            let savedCard = await service.save(card);
            let patchedCard = await savedCard.patch({
                data: {
                    type: 'cards',
                    attributes: {
                        favoriteColor: 'orange',
                    },
                },
            });
            let updatedCard = await service.save(patchedCard);
            assert.equal(updatedCard.csId, savedCard.csId, 'the card csId isCorect');
            assert.equal(updatedCard.csRealm, csRealm, 'the card csRealm is correct');
            assert.equal(updatedCard.csOriginalRealm, csRealm, 'the card csOriginalRealm is correct');
            assert.equal(await updatedCard.value('name'), 'Van Gogh', 'the card user field value is correct');
            assert.equal(await updatedCard.value('favoriteColor'), 'orange', 'the card user field value is correct');
            let retreivedCard = await service.load(savedCard, 'everything');
            assert.equal(retreivedCard.csId, savedCard.csId, 'the card csId isCorect');
            assert.equal(retreivedCard.csRealm, csRealm, 'the card csRealm is correct');
            assert.equal(retreivedCard.csOriginalRealm, csRealm, 'the card csOriginalRealm is correct');
            assert.equal(await retreivedCard.value('name'), 'Van Gogh', 'the card user field value is correct');
            assert.equal(await retreivedCard.value('favoriteColor'), 'orange', 'the card user field value is correct');
        });
        test('it deletes a card', async function (assert) {
            let service = this.owner.lookup('service:data');
            let card = await service.create(csRealm, cardDocument().withAutoAttributes({
                name: 'Van Gogh',
                favoriteColor: 'teal',
            }).jsonapi);
            let savedCard = await service.save(card);
            await service.delete(savedCard);
            try {
                await service.load(savedCard, 'everything');
                throw new Error('should not be able to find the deleted card');
            }
            catch (err) {
                assert.equal(err.status, 404);
            }
        });
    });
});
//# sourceMappingURL=data-test.js.map