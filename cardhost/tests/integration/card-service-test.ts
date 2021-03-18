import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import type Cards from 'cardhost/services/cards';
import setupCardMocking from '../helpers/card-mocking';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { templateOnlyComponentTemplate } from '../helpers/template-compiler';

module('Integration | card-service', function (hooks) {
  setupRenderingTest(hooks);
  setupMirage(hooks);
  setupCardMocking(hooks);

  let cards: Cards;
  hooks.beforeEach(function () {
    cards = this.owner.lookup('service:cards');
  });

  test('compiled-cards dynamic import example', async function (assert) {
    let target = 'hello';
    this.set('hello', (await import(`@cardstack/compiled/${target}`)).default);

    await render(
      hbs`{{#let (ensure-safe-component this.hello) as |Hello|}} <Hello /> {{/let}}`
    );
    assert.dom(this.element).containsText('Hello world');
  });

  module('hello world', function (hooks) {
    let helloId = 'http://mirage/cards/hello';
    let greenId = 'http://mirage/cards/green';
    hooks.beforeEach(function () {
      this.createCard({
        url: greenId,
        files: {
          'schema.js': `export default class Green {}`,
          'embedded.js': templateOnlyComponentTemplate(
            `<span class="green">{{@model}}</span>`
          ),
        },
      });

      this.createCard({
        url: helloId,
        files: {
          'data.json': {
            attributes: {
              greeting: 'Hello World',
              greenGreeting: 'it works',
            },
          },
          'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/models/string";
          import green from "${greenId}"

          export default class Hello {
            @contains(string)
            greeting;

            @contains(green)
            greenGreeting;
          }
        `,
          'isolated.js': templateOnlyComponentTemplate(
            `<h1><@model.greeting /></h1><h2><@model.greenGreeting /></h2>`
          ),
        },
      });
    });

    test(`load an isolated card's component`, async function (assert) {
      let { component } = await cards.load(helloId, 'isolated');
      this.set('component', component);
      await render(hbs`<this.component />`);
      assert.dom('h1').containsText('Hello World');
      assert.dom('h2 .green').containsText('it works');
    });

    test(`load an isolated card's model`, async function (assert) {
      let { model } = await cards.load(helloId, 'isolated');
      assert.deepEqual(model, {
        greeting: 'Hello World',
        greenGreeting: 'it works',
        id: helloId,
      });
    });
  });
});
