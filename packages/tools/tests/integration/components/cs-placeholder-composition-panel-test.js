import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs placeholder composition panel', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    this.store = this.owner.lookup('service:store');
    this.set('content', {
      isCardstackPlaceholder: true,
      type: 'page',
      slug: 'somewhere',
      branch: 'x',
    });
  });

  test('it renders', async function(assert) {
    await render(hbs`{{cs-placeholder-composition-panel content=content}}`);
    assert.equal(
      this.$('.content-title')
        .text()
        .trim(),
      'Not found',
    );
  });
});
