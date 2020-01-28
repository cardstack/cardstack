import { module, test, skip } from 'qunit';
import { myOrigin } from '@cardstack/core/origin';
import { setupTest } from 'ember-qunit';
import { testCard } from '@cardstack/test-support/test-card';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;

// const scenario = new Fixtures({
//   destroy() {
//     return [
//       { type: 'cards', id: card7Id },
//       { type: 'cards', id: card6Id },
//       { type: 'cards', id: card5Id },
//       { type: 'cards', id: card4Id },
//       { type: 'cards', id: card3Id },
//       { type: 'cards', id: card2Id },
//       { type: 'cards', id: card1Id },
//     ];
//   },
// });

module('Unit | Service | data', function() {
  module('mutating tests', function(hooks) {
    setupTest(hooks);
    // scenario.setupTest(hooks);

    hooks.beforeEach(async function() {
      // await this.owner
      //   .lookup('service:mock-login')
      //   .get('login')
      //   .perform('sample-user');
      // this.owner.lookup('service:data')._clearCache();
    });

    hooks.afterEach(async function() {
      // this.owner.lookup('service:data')._clearCache();
    });

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

    skip('it saves an UnsavedCard', async function(assert) {
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
  });
});
