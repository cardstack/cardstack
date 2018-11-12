import { module, test, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field-editors/cardstack-cards-editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it does not render edit controls if it is not enabled', async function(assert) {
    await render(hbs`{{field-editors/cardstack-cards-editor}}`);

    assert.dom('[data-test-add-card]').doesNotExist();
  });

  test('it renders edit controls if it is enabled', async function(assert) {
    this.set('enabled', true);
    await render(hbs`{{field-editors/cardstack-cards-editor enabled=enabled}}`);

    assert.dom('[data-test-add-card]').exists();
    assert.dom('[data-test-add-card]').hasText('Add Card');
    assert.dom('[data-test-delete-card]').doesNotExist();
  });

  // TODO: figure out how to get this to work with jQuery turned off
  skip('it allows you to delete card if enabled and has field content', async function(assert) {
    this.set('enabled', true);
    this.set('actions', {
      orderChanged() {},
    });

    this.set('content', {
      articles: [
        {
          id: '55',
          type: 'super-fake-card',
        },
        {
          id: '57',
          type: 'super-fake-card',
        },
      ],
    });

    this.set('field', 'articles');

    await render(hbs`{{field-editors/cardstack-cards-editor enabled=enabled content=content field=field}}`);

    assert.dom('[data-test-add-card]').exists();
    assert.dom('[data-test-add-card]').hasText('Add Card');
    assert.dom('[data-test-delete-card]').exists(2);
    assert.dom('[data-test-reorder-card]').exists(2);
  });
});
