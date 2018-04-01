import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs mobiledoc editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('sample', {
      "version": "0.3.0",
      "atoms": [],
      "cards": [],
      "markups": [],
      "sections": [
        [
          1,
          "p",
          [
            [
              0,
              [],
              0,
              "First paragraph."
            ]
          ]
        ]
      ]
    });
    await render(hbs`{{cs-mobiledoc-editor mobiledoc=sample}}`);
    assert.equal(this.$().text().trim(), 'First paragraph.');
  });
});
