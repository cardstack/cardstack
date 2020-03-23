import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { percySnapshot } from 'ember-percy';
import Fixtures from '../helpers/fixtures';
import { waitForSchemaViewToLoad, waitForTestsToEnd } from '../helpers/card-ui-helpers';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';

// Monaco takes a while to render, and it varies, so we pause
// for 2s in order to get more stable Percy Snapshots.
const waitForMonacoRender = function(cb) {
  return new Promise(resolve => {
    setTimeout(() => {
      cb();
      resolve('done');
    }, 2000);
  });
};

const scenario = new Fixtures({
  destroy: {
    cardTypes: [{ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }],
  },
});

module('Acceptance | ui components', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test('visiting /ui-components', async function(assert) {
    await visit('/ui-components');
    await waitForSchemaViewToLoad();

    assert.equal(currentURL(), '/ui-components');

    await waitForMonacoRender(() => percySnapshot(assert));
  });
});
