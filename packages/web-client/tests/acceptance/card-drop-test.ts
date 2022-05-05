import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import percySnapshot from '@percy/ember';

module('Acceptance | card-drop', function (hooks) {
  setupApplicationTest(hooks);

  test('it shows a success message', async function (assert) {
    assert.expect(0);
    await visit('/card-drop/success');
    await percySnapshot(assert, { widths: [375, 1280] });
  });
});
