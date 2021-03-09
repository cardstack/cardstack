import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | card-service', function (hooks) {
  setupRenderingTest(hooks);

  test('temp', async function (assert) {
    let target = 'hello';
    this.set('hello', (await import(`@cardstack/compiled/${target}`)).default);

    await render(
      hbs`{{#let (ensure-safe-component this.hello) as |Hello|}} <Hello /> {{/let}}`
    );
    assert.dom(this.element).containsText('Hello world');
    assert.ok(
      false,
      'replace this with a test that asserts about cards that came from the base-cards directory'
    );
  });
});
