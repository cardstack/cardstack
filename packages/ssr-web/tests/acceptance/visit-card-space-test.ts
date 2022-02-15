import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { currentURL, visit } from '@ember/test-helpers';
import config from '@cardstack/ssr-web/config/environment';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { LocationService } from '@cardstack/ssr-web/services/location';
import Service from '@ember/service';
import percySnapshot from '@percy/ember';

class MockLocation extends Service implements LocationService {
  hostname = `displayNametodo.${config.cardSpaceHostnameSuffix}`;
}

module('Acceptance | visit card space', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    this.owner.register('service:location', MockLocation);
  });

  test('renders a user’s card space', async function (assert) {
    await visit('/');

    assert
      .dom('[data-test-card-space-display-name]')
      .hasText('displayNametodo');

    await percySnapshot(assert);
  });

  test('redirects from other links', async function (assert) {
    await visit('/card-pay/wallet');

    assert.equal(currentURL(), '/');
    assert
      .dom('[data-test-card-space-display-name]')
      .hasText('displayNametodo');
  });
});
