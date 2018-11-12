import { module, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs create menu', function(hooks) {
  setupRenderingTest(hooks);

  skip('it renders', function(assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    this.render(hbs`{{cs-create-menu}}`);

    assert.equal(
      this.$()
        .text()
        .trim(),
      '',
    );

    // Template block usage:
    this.render(hbs`
      {{#cs-create-menu}}
        template block text
      {{/cs-create-menu}}
    `);

    assert.equal(
      this.$()
        .text()
        .trim(),
      'template block text',
    );
  });
});
