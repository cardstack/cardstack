import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Helper | percent-complete', function (hooks) {
  setupRenderingTest(hooks);

  test('it calculated', async function (assert) {
    this.set('total', 4);
    this.set('completed', 2);

    await render(hbs`{{percent-complete total=total completed=completed}}`);

    assert.equal(this.element.textContent.trim(), '50');
  });

  test('it handles missing total', async function (assert) {
    this.set('total', undefined);
    this.set('completed', 2);

    await render(hbs`{{percent-complete total=total completed=completed}}`);

    assert.equal(this.element.textContent.trim(), '0');
  });

  test('it handles missing completed', async function (assert) {
    this.set('total', 4);
    this.set('completed', null);

    await render(hbs`{{percent-complete total=total completed=completed}}`);

    assert.equal(this.element.textContent.trim(), '0');
  });
});
