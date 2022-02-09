import { module, test, skip } from 'qunit';
import { setupCardTest } from '../helpers/setup';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';

import type Cards from 'cardhost/services/cards';
import type CardModelForBrowser from 'cardhost/lib/card-model-for-browser';

module('Integration | card-service', function (hooks) {
  let { createCard, renderCard, localRealmURL } = setupCardTest(hooks);

  let cards: Cards;
  hooks.beforeEach(function () {
    cards = this.owner.lookup('service:cards');
  });

  module('blog post', function (hooks) {
    let cardID = `${localRealmURL}post-1`;

    hooks.beforeEach(function () {
      createCard({
        id: 'post',
        realm: localRealmURL,
        schema: 'schema.js',
        isolated: 'isolated.js',
        embedded: 'isolated.js',
        files: {
          'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import datetime from "https://cardstack.com/base/datetime";

          export default class Hello {
            @contains(string)
            title;

            @contains(datetime)
            createdAt;
          }
        `,
          'isolated.js': templateOnlyComponentTemplate(
            `<h1><@fields.title /></h1><h2><@fields.createdAt /></h2>`
          ),
        },
      });

      createCard({
        id: 'post-1',
        realm: localRealmURL,
        adoptsFrom: `${localRealmURL}post`,
        data: {
          title: 'A blog post title',
          createdAt: '2021-03-02T19:51:32.121Z',
        },
      });
    });

    test(`load a cards isolated component`, async function (assert) {
      await renderCard({ id: 'post-1' });
      assert.dom('h1').containsText('A blog post title');
      assert.dom('h2').containsText('Mar 2, 2021');
    });

    test(`load a card's isolated view and model`, async function (assert) {
      let model = (await cards.load(cardID, 'isolated')) as CardModelForBrowser;
      await model.computeData();
      assert.equal(model.url, cardID, '@model id is correct');
      assert.equal(
        model.data.title,
        'A blog post title',
        'post title is correct'
      );
      assert.ok(
        model.data.createdAt instanceof Date,
        'CreatedAt is an instance of Date'
      );
      assert.equal(
        model.data.createdAt.getTime(),
        1614714692121,
        'post created at is correct'
      );
    });

    test(`load a cards edit component`, async function (assert) {
      await renderCard({ id: 'post-1' }, 'edit');
      assert
        .dom('[data-test-field-name="title"]')
        .hasValue('A blog post title');
      assert.dom('[data-test-field-name="createdAt"]').hasAnyValue();
    });

    skip('Serialization works on nested cards', async function (assert) {
      createCard({
        id: 'post-list',
        realm: localRealmURL,
        schema: 'schema.js',
        isolated: 'isolated.js',
        data: {
          posts: [
            {
              title: 'A blog post title',
              createdAt: '2021-05-17T15:31:21+0000',
            },
          ],
        },
        files: {
          'schema.js': `
            import { containsMany } from "@cardstack/types";
            import post from "${localRealmURL}post";

            export default class Hello {
              @containsMany(post)
              posts;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate(
            `{{#each @fields.posts as |Post|}}<Post />{{/each}}`
          ),
        },
      });

      await renderCard({ id: 'post-list' });
      assert.dom('h1').containsText('A blog post title');
      assert.dom('h2').containsText('May 17, 2021');

      let model = await cards.load(`${localRealmURL}post-list`, 'isolated');
      assert.ok(
        model.data.posts[0].createdAt instanceof Date,
        'CreatedAt is an instance of Date'
      );
      assert.equal(
        model.data.posts[0].createdAt.getTime(),
        1621265481000,
        'post created at is correct'
      );
    });
  });
});
