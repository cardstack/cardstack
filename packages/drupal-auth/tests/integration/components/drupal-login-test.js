import { module, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | drupal login', function(hooks) {
  setupRenderingTest(hooks);

  skip('it renders', function(assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    this.render(hbs`{{drupal-login}}`);

    assert.equal(
      this.$()
        .text()
        .trim(),
      '',
    );

    // Template block usage:
    this.render(hbs`
      {{#drupal-login}}
        template block text
      {{/drupal-login}}
    `);

    assert.equal(
      this.$()
        .text()
        .trim(),
      'template block text',
    );
  });
});
