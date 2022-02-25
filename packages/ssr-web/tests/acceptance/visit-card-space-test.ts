import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit } from '@ember/test-helpers';
import { MirageTestContext, setupMirage } from 'ember-cli-mirage/test-support';
import { AppContextService } from '@cardstack/ssr-web/services/app-context';
import Service from '@ember/service';
import percySnapshot from '@percy/ember';

class MockAppContext extends Service implements AppContextService {
  currentApp = 'card-space' as 'card-space'; // ?!
  cardSpaceId = 'slug';
  // host = 'slug.card.space.localhost:4210';
}

module('Acceptance | visit card space', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    this.owner.register('service:app-context', MockAppContext);
  });

  test('renders a user’s card space', async function (this: MirageTestContext, assert) {
    let cardSpace = this.server.create('card-space', {
      slug: 'slug',
    });

    cardSpace.createMerchantInfo({ name: 'merchant name' });

    await visit('/');

    assert.dom('[data-test-merchant-name]').hasText('merchant name');

    await percySnapshot(assert);
  });

  /*
  test('redirects from other links', async function (assert) {
    await visit('/card-pay/wallet');

    assert.equal(currentURL(), '/');
    assert
      .dom('[data-test-card-space-display-name]')
      .hasText('displayNametodo');
  });
  */
});
