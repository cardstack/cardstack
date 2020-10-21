import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | mode-indicator', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`<ModeIndicator />`);

    assert.dom('[data-test-mode-indicator]').exists();
  });

  test('it renders with label and link-to', async function(assert) {
    this.set('model', { id: 'card-1' });
    await render(hbs`
    <ModeIndicator
      @card={{model}}
      @route="cards.card.view"
      @mode="edit" />
    `);

    assert.dom('[data-test-mode-indicator-link="edit"]').exists();
    assert.dom('[data-test-mode-indicator]').containsText('edit mode');
  });
});
