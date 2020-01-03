import { module, test } from 'qunit';
import { visit, currentURL, settled } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { percySnapshot } from 'ember-percy';

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

module('Acceptance | ui components', function(hooks) {
  setupApplicationTest(hooks);

  test('visiting /ui-components', async function(assert) {
    await visit('/ui-components');

    assert.equal(currentURL(), '/ui-components');
    await settled();
    await waitForMonacoRender(() => percySnapshot(assert));
  });
});
