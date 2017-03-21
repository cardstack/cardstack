import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-mobiledoc-editor', 'Integration | Component | cs mobiledoc editor', {
  integration: true
});

test('it renders', function(assert) {
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
  this.render(hbs`{{cs-mobiledoc-editor mobiledoc=sample}}`);
  assert.equal(this.$().text().trim(), 'First paragraph.');
});
