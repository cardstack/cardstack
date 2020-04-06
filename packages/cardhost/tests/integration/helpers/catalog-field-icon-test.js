import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Helper | catalog-field-icon', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('inputValue', 'Text');

    await render(hbs`{{catalog-field-icon this.inputValue}}`);

    assert.equal(this.element.textContent.trim(), 'string-field-icon');
  });

  test('it has a default icon', async function(assert) {
    this.set('inputValue', 'something nonexistant');

    await render(hbs`{{catalog-field-icon this.inputValue}}`);

    assert.equal(this.element.textContent.trim(), 'has-many-field-icon');
  });
});
