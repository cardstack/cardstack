import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import type Cards from 'cardhost/services/cards';

module('Integration | card-service', function (hooks) {
  setupRenderingTest(hooks);

  let cards: Cards;
  hooks.beforeEach(function () {
    cards = this.owner.lookup('service:cards');
  });

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

  module('hello world', function (hooks) {
    setupMirage(hooks);

    hooks.before(function () {
      server.create(rawCardGoesHere);
    });

    test(`load an isolated card's component`, async function (assert) {
      let { component } = await cards.load(
        'http://mirage/cards/hello',
        'isolated'
      );
      this.set('component', component);
      await render(hbs`<this.component/>`);
      assert.dom(this.element).containsText('Hello world');
    });

    test(`load an isolated card's model`, async function (assert) {
      let { model } = await cards.load('http://mirage/cards/hello', 'isolated');
      assert.deepEqual(model, { title: 'Hello world' });
    });
  });
});
