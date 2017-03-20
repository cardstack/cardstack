import { moduleForComponent, skip } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-mobiledoc-overview', 'Integration | Component | cs mobiledoc overview', {
  integration: true
});

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
  assert.equal(this.$('li').length, 1);
});
