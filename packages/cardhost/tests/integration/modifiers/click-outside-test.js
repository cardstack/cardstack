import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Modifier | click-outside', function(hooks) {
  setupRenderingTest(hooks);

  test('clicking outside triggers the method call', async function(assert) {
    assert.expect(2); // expect 2 because there's both click and focus events fire for buttons
    this.someMethod = () => {
      assert.ok(true, 'click outside method was called');
    };
    await render(hbs`<div {{click-outside this.someMethod}}></div> <button></button>`);
    await click('button');
  });

  test('clicking ignored element does not trigger method call', async function(assert) {
    assert.expect(0);
    this.someMethod = () => {
      assert.ok(true, 'click outside method was called');
    };
    await render(
      hbs`<div {{click-outside this.someMethod ignore=".ignore-me"}}></div> <button class="ignore-me"></button>`
    );
    await click('button');
  });

  test('clicking non-ignored element triggers method call', async function(assert) {
    assert.expect(2);
    this.someMethod = () => {
      assert.ok(true, 'click outside method was called');
    };
    await render(
      hbs`<div {{click-outside this.someMethod ignore=".ignore-me"}}></div> <button class="ignore-me"></button><button class="do-not-ignore"></button>`
    );
    await click('.do-not-ignore');
  });
});
