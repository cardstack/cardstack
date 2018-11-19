import { module, test, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | card-picker-edges', function(hooks) {
  setupRenderingTest(hooks);

  skip('Renders picker as bottom edge', async function(assert) {

    await render(hbs`{{card-picker-edges}}`);

    // waitFor('[data-card-picker-toolbox-header]');

    assert.dom('[data-card-picker-toolbox-header]').exists();
  });

});
