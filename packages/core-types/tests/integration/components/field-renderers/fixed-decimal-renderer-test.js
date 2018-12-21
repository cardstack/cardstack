import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field renderers/fixed decimal renderer', function(hooks) {
  setupRenderingTest(hooks);

  test('it rounds to the correct number of decimal places', async function(assert) {
    this.set('value', 5.4321);
    await this.render(hbs`{{field-renderers/fixed-decimal-renderer value=value}}`);

    assert.equal(this.$().text().trim(), '5.43', 'renderer rounds to 2 significant digits');

    this.set('value', 5.40000);
    await this.render(hbs`{{field-renderers/fixed-decimal-renderer value=value}}`);

    assert.equal(this.$().text().trim(), '5.4', 'renderer rounds to 1 significant digit');

    this.set('value', 5.4);
    await this.render(hbs`{{field-renderers/fixed-decimal-renderer value=value}}`);

    assert.equal(this.$().text().trim(), '5.4', 'renderer rounds to 1 significant digit');

    this.set('value', 5.0);
    await this.render(hbs`{{field-renderers/fixed-decimal-renderer value=value}}`);

    assert.equal(this.$().text().trim(), '5', 'renderer rounds to integer');
  });
});
