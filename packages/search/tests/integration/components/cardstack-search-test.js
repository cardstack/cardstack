import { module, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cardstack search', function(hooks) {
  setupRenderingTest(hooks);

  skip('it renders', function(assert) {

    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    this.render(hbs`{{cardstack-search}}`);

    assert.equal(this.$().text().trim(), '');

    // Template block usage:
    this.render(hbs`
      {{#cardstack-search}}
        template block text
      {{/cardstack-search}}
    `);

    assert.equal(this.$().text().trim(), 'template block text');
  });
});
