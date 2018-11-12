import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field-editors/cardstack-card-editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it reports no card selected when field content is missing', async function(assert) {
    await render(hbs`{{field-editors/cardstack-card-editor}}`);

    assert.dom('[data-test-no-content]').exists();
  });

  test('it does not render edit controls if it is not enabled', async function(assert) {
    await render(hbs`{{field-editors/cardstack-card-editor}}`);

    assert.dom('[data-test-add-card]').doesNotExist();
  });

  test('it renders edit controls if it is enabled', async function(assert) {
    this.set('enabled', true);
    await render(hbs`{{field-editors/cardstack-card-editor enabled=enabled}}`);

    assert.dom('[data-test-add-card]').exists();
    assert.dom('[data-test-add-card]').hasText('Add Card');
    assert.dom('[data-test-delete-card]').doesNotExist();
  });

  test('it allows you to delete card if enabled and has field content', async function(assert) {
    this.set('enabled', true);

    this.set('content', {
      article: {
        id: '55',
        type: 'super-fake-card',
      },
    });

    this.set('field', 'article');

    await render(hbs`{{field-editors/cardstack-card-editor enabled=enabled content=content field=field}}`);

    assert.dom('[data-test-add-card]').exists();
    assert.dom('[data-test-add-card]').hasText('Change Card');
    assert.dom('[data-test-delete-card]').exists();
  });
});
