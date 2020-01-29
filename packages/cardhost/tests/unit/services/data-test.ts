import { module, test, skip } from 'qunit';
import { myOrigin } from '@cardstack/core/origin';
import { setupTest } from 'ember-qunit';
import { cardDocument, CardDocumentWithId } from '@cardstack/core/card-document';
import Fixtures from '../../helpers/fixtures';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import DataService from '../../../app/services/data';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;

module('Unit | Service | data', function() {
  module('non-mutating tests', function(hooks) {
    let toyCard: CardDocumentWithId = cardDocument()
      .withAttributes({
        csRealm,
        csId: 'toy-card',
      })
      .withField('description', 'string-field');

    let puppyCard: CardDocumentWithId = cardDocument()
      .withAttributes({
        csRealm,
        csId: 'puppy-card',
        csFieldSets: {
          embedded: ['name'],
        },
      })
      .withField('name', 'string-field')
      .withField('favoriteToy', toyCard);

    let dalmatianCard: CardDocumentWithId = cardDocument()
      .withAttributes({
        csRealm,
        csId: 'dalmatian-card',
      })
      .adoptingFrom(puppyCard);

    let ownerCard: CardDocumentWithId = cardDocument()
      .withAttributes({
        csRealm,
        csId: 'owner-card',
        csFieldSets: {
          isolated: ['name', 'puppies'],
        },
      })
      .withField('name', 'string-field')
      .withField('puppies', puppyCard, 'plural');

    let squeakySnake: CardDocumentWithId = cardDocument()
      .withAttributes({
        csRealm,
        csId: 'squeaky-snake',
        description: 'a plush snake with squeaky segments',
      })
      .adoptingFrom(toyCard);

    let vanGogh: CardDocumentWithId = cardDocument()
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
      .adoptingFrom(dalmatianCard);

    let mango: CardDocumentWithId = cardDocument()
      .withAttributes({
        csRealm,
        csId: 'mango',
        name: 'Mango',
      })
      .withRelationships({ favoriteToy: squeakySnake })
      .adoptingFrom(dalmatianCard);

    let daddy: CardDocumentWithId = cardDocument()
      .withAttributes({
        csRealm,
        csId: 'hassan',
        name: 'Hassan',
      })
      .withRelationships({ puppies: [vanGogh, mango] })
      .adoptingFrom(ownerCard);

    let mommy: CardDocumentWithId = cardDocument()
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

    test('it can get a card by id', async function(assert) {
      let service = this.owner.lookup('service:data') as DataService;
      let card = await service.load(mango);

      assert.equal(card.csId, mango.csId, 'the csId is correct');
      assert.equal(card.csRealm, mango.csRealm, 'the csRealm is correct');
      assert.equal(card.csOriginalRealm, card.csRealm, 'the csOriginalRealm is correct');
    });

    skip('it can search for cards', async function() {});
    skip("it can get a value of a card's primitive field", async function() {});
    skip('it can get a card-as-value value of a card field', async function() {});
    skip('it can get a card-as-reference value of a card field', async function() {});
    skip('it can get a card-as-value value of a card artity > 1 field', async function() {});
    skip('it can get a card-as-reference value of a card artity > 1 field', async function() {});
    skip('it can get a card with fully expanded pristine doc', async function() {});
    skip('it can get a card with isolated fieldset format', async function() {});
    skip('it can get a card with embedded fieldset format', async function() {});
    skip('it can get a card with specific field includes', async function() {});
    skip('it can get a card with an isolated field set and specified field includes', async function() {});
  });

  module('mutating tests', function(hooks) {
    const scenario = new Fixtures({
      destroy: {
        cardTypes: [{ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }],
      },
    });

    setupTest(hooks);
    scenario.setupTest(hooks);

    test('it creates an UnsavedCard', async function(assert) {
      let service = this.owner.lookup('service:data') as DataService;
      let card = await service.create(
        csRealm,
        cardDocument().withAutoAttributes({
          name: 'Van Gogh',
        }).jsonapi
      );
      assert.notOk(card.csId, 'the card csId does not exist');
      assert.equal(card.csRealm, csRealm, 'the card csRealm is correct');
      assert.equal(card.csOriginalRealm, csRealm, 'the card csOriginalRealm is correct');
      assert.equal(await card.value('name'), 'Van Gogh', 'the card user field value is correct');
    });

    test('it saves an UnsavedCard', async function(assert) {
      let service = this.owner.lookup('service:data') as DataService;
      let card = await service.create(
        csRealm,
        cardDocument().withAutoAttributes({
          name: 'Van Gogh',
        }).jsonapi
      );

      let savedCard = await service.save(card);

      assert.ok(savedCard.csId, 'the card csId exists');
      assert.equal(savedCard.csRealm, csRealm, 'the card csRealm is correct');
      assert.equal(savedCard.csOriginalRealm, csRealm, 'the card csOriginalRealm is correct');
      assert.equal(await savedCard.value('name'), 'Van Gogh', 'the card user field value is correct');
    });

    skip('it patches a card', async function() {});
    skip('it deletes a card', async function() {});
  });
});
