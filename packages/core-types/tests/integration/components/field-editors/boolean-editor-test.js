import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/boolean editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', {
      addKetchup: false
    });
    await render(hbs`{{field-editors/boolean-editor content=model field="addKetchup" enabled=true}}`);
    assert.dom('.cs-toggle-switch').hasText('Off', 'slider has correct value');
    assert.dom('.cs-toggle-switch.disabled').doesNotExist('slider is not disabled');

    await click('.cs-toggle-switch');
    assert.dom('.cs-toggle-switch').hasText('On', 'slider has correct value');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {
      addKetchup: false
    });
    await render(hbs`{{field-editors/boolean-editor content=model field="addKetchup" enabled=false}}`);
    assert.dom('.cs-toggle-switch.disabled').exists('slider is disabled');
  });
});
