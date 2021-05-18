import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import type Cards from 'cardhost/services/cards';
import setupCardMocking from '../helpers/card-mocking';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { encodeCardURL } from '@cardstack/core/src/utils';

module('Integration | card-service', function (hooks) {
  setupRenderingTest(hooks);
  setupMirage(hooks);
  setupCardMocking(hooks);

  let cards: Cards;
  hooks.beforeEach(function () {
    cards = this.owner.lookup('service:cards');
  });

  module('blog post', function (hooks) {
    let cardID = 'http://mirage/cards/post-1';

    hooks.beforeEach(function () {
      this.createCard({
        url: cardID,
        schema: 'schema.js',
        isolated: 'isolated.js',
        data: {
          title: 'A blog post title',
          createdAt: '2021-05-17T15:31:21+0000',
        },
        files: {
          'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import date from "https://cardstack.com/base/date";

          export default class Hello {
            @contains(string)
            title;

            @contains(date)
            createdAt;
          }
        `,
          'isolated.js': templateOnlyComponentTemplate(
            `<h1><@fields.title /></h1><h2><@fields.createdAt /></h2>`
          ),
        },
      });
    });

    test(`load an isolated card's component`, async function (assert) {
      let { component } = await cards.load(cardID, 'isolated');
      this.set('component', component);
      await render(hbs`<this.component />`);
      assert.dom('h1').containsText('A blog post title');
      assert.dom('h2').containsText('May 17, 2021');
    });

    test(`load an isolated card's model`, async function (assert) {
      let { model } = await cards.load(cardID, 'isolated');
      assert.equal(model.id, encodeCardURL(cardID), '@model id is correct');
      assert.equal(model.title, 'A blog post title', 'post title is correct');
      assert.ok(
        model.createdAt instanceof Date,
        'CreatedAt is an instance of Date'
      );
      assert.equal(
        model.createdAt.getTime(),
        1621265481000,
        'post created at is correct'
      );
    });
  });
});
