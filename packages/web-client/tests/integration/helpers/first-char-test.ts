import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | first-char', function (hooks) {
  setupRenderingTest(hooks);

  test('it returns first character of given string', async function (assert) {
    this.set('val', 'Crazy Horse');
    await render(hbs`{{first-char this.val}}`);
    assert.equal(this.element.textContent?.trim(), 'C');
  });

  test('it ignores empty space at the beginning', async function (assert) {
    this.set('val', '   &Crazy Horse');
    await render(hbs`{{first-char this.val}}`);
    assert.equal(this.element.textContent?.trim(), '&');
  });

  test('it converts non-string input to string and returns first character', async function (assert) {
    this.set('val', 577);
    await render(hbs`{{first-char this.val}}`);
    assert.equal(this.element.textContent?.trim(), '5');
  });
});
