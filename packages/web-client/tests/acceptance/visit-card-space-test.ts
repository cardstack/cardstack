import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit } from '@ember/test-helpers';
import config from '@cardstack/web-client/config/environment';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { LocationService } from '@cardstack/web-client/services/location';
import Service from '@ember/service';
import percySnapshot from '@percy/ember';

class MockLocation extends Service implements LocationService {
  hostname = `usernametodo.${config.cardSpaceHostnameSuffix}`;
}

module('Acceptance | visit card space', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    this.owner.register('service:location', MockLocation);
  });

  test('renders a user’s card space', async function (assert) {
    await visit('/');

    assert.dom('[data-test-card-space-username]').hasText('usernametodo');

    await percySnapshot(assert);
  });
});
