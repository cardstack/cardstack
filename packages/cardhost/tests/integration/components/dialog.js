import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | dialog', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`<Dialog>Hello</Dialog>`);
    assert.dom('[data-test-dialog-box]').exists();
    assert.dom('[data-test-dialog-box]').isNotVisible();
  });

  test('it can be visible', async function(assert) {
    await render(hbs`<Dialog open={{true}}>Hello</Dialog>`);
    assert.dom('[data-test-dialog-box]').isVisible();
    assert.dom('[data-test-dialog-box]').hasText('Hello');
  });

  test('it can render without title', async function(assert) {
    await render(hbs`<Dialog open={{true}}>Hello</Dialog>`);
    assert.dom('[data-test-dialog-box]').isVisible();
    assert.dom('[data-test-dialog-box] h1').doesNotExist();
    assert.dom('[data-test-dialog-box]').hasText('Hello');
  });

  test('it renders with given title', async function(assert) {
    await render(hbs`<Dialog open={{true}} @title="Attention" />`);
    assert.dom('[data-test-dialog-box]').isVisible();
    assert.dom('[data-test-dialog-box]').hasText('Attention');
    assert.dom('[data-test-dialog-box] h1 svg').doesNotExist();
    assert.dom('[data-test-dialog-box] h1 button').doesNotExist();
  });

  test('it renders with icon', async function(assert) {
    await render(hbs`<Dialog open={{true}} @title="Attention" @icon="error">System error</Dialog>`);
    assert.dom('[data-test-dialog-box]').isVisible();
    assert.dom('[data-test-dialog-box] h1 svg').exists();
  });
});
