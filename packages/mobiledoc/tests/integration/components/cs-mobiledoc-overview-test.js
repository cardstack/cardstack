import { module, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { findAll } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs mobiledoc overview', function(hooks) {
  setupRenderingTest(hooks);

  skip('it renders', function(assert) {
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
    this.render(hbs`{{cs-mobiledoc-overview mobiledoc=sample}}`);
    assert.dom('li').exists({ count: 1 });
  });
});
