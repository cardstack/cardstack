import { module, test, skip } from 'qunit';
import { myOrigin } from '@cardstack/core/origin';
import { setupTest } from 'ember-qunit';
import { testCard } from '@cardstack/test-support/test-card';
import Fixtures from '../../helpers/fixtures';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;

module('Unit | Service | data', function() {
  module('non-mutating tests', function() {
    skip('it can get a card', async function() {});
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
      let service = this.owner.lookup('service:data');
      let card = await service.create(
        csRealm,
        testCard().withAutoAttributes({
          name: 'Van Gogh',
        }).jsonapi
      );
      assert.notOk(card.csId, 'the card csId does not exist');
      assert.equal(card.csRealm, csRealm, 'the card csRealm is correct');
      assert.equal(card.csOriginalRealm, csRealm, 'the card csOriginalRealm is correct');
      assert.equal(await card.value('name'), 'Van Gogh', 'the card user field value is correct');
    });

    test('it saves an UnsavedCard', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.create(
        csRealm,
        testCard().withAutoAttributes({
          name: 'Van Gogh',
        }).jsonapi
      );
      card = await service.save(card);

      assert.ok(card.csId, 'the card csId exists');
      assert.equal(card.csRealm, csRealm, 'the card csRealm is correct');
      assert.equal(card.csOriginalRealm, csRealm, 'the card csOriginalRealm is correct');
      assert.equal(await card.value('name'), 'Van Gogh', 'the card user field value is correct');
    });

    skip('it patches an addressable card', async function() {});
    skip('it deletes a card', async function() {});
    skip("it changes a card's parent card", async function() {});
    skip('it changes to a parent card are reflected in child cards', async function() {});
  });
});
