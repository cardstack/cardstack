import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | card-size-toggle', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    this.set('model', {});
    await render(hbs`<CardSizeToggle />`);
    assert.dom('[data-test-card-size-toggle]').exists();
    assert.dom('[data-test-card-size-toggle]').hasText('S M L');
    assert.dom('[data-test-small-btn]').exists();
    assert.dom('[data-test-medium-btn]').exists();
    assert.dom('[data-test-large-btn]').exists();
  });

  test('it can select size', async function (assert) {
    this.set('model', {});
    await render(hbs`<CardSizeToggle />`);
    assert.dom('[data-test-card-size-toggle]').exists();
    assert.dom('[data-test-medium-btn]').hasClass('selected');
    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');

    await click('[data-test-small-btn]');
    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-large-btn]').doesNotHaveClass('selected');

    await click('[data-test-large-btn]');
    assert.dom('[data-test-large-btn]').hasClass('selected');
    assert.dom('[data-test-small-btn]').doesNotHaveClass('selected');
    assert.dom('[data-test-medium-btn]').doesNotHaveClass('selected');
  });
});
