import { module, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | github login', function(hooks) {
  setupRenderingTest(hooks);

  skip('it renders', function(assert) {

    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    this.render(hbs`{{github-login}}`);

    assert.equal(this.element.textContent.trim(), '');

    // Template block usage:
    this.render(hbs`
      {{#github-login}}
        template block text
      {{/github-login}}
    `);

    assert.equal(this.element.textContent.trim(), 'template block text');
  });
});
