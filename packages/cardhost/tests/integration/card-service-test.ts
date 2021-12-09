import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import type Cards from 'cardhost/services/cards';
import setupBuilder from '../helpers/setup-builder';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { LOCAL_REALM } from 'cardhost/lib/builder';

module('Integration | card-service', function (hooks) {
  setupRenderingTest(hooks);
  setupBuilder(hooks);

  let cards: Cards;
  hooks.beforeEach(function () {
    cards = this.owner.lookup('service:cards');
  });

  module('blog post', function (hooks) {
    let cardID = `${LOCAL_REALM}/post-1`;

    hooks.beforeEach(function () {
      this.builder.createRawCard({
        id: 'post',
        realm: LOCAL_REALM,
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

      this.builder.createRawCard({
        id: 'post-1',
        realm: LOCAL_REALM,
        adoptsFrom: `${LOCAL_REALM}/post`,
        data: {
          title: 'A blog post title',
          createdAt: '2021-03-02T19:51:32.121Z',
        },
      });
    });

    test(`load a cards isolated component`, async function (assert) {
      let { component } = await cards.load(cardID, 'isolated');
      this.set('component', component);
      await render(hbs`<this.component />`);
      assert.dom('h1').containsText('A blog post title');
      assert.dom('h2').containsText('Mar 2, 2021');
    });

    test(`load a card's isolated view and model`, async function (assert) {
      let model = await cards.load(cardID, 'isolated');
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
      let { component } = await cards.load(cardID, 'edit');
      this.set('component', component);
      await render(hbs`<this.component />`);
      assert
        .dom('[data-test-field-name="title"]')
        .hasValue('A blog post title');
      assert.dom('[data-test-field-name="createdAt"]').hasAnyValue();
    });

    test('Serialization works on nested cards', async function (assert) {
      this.builder.createRawCard({
        id: 'post-list',
        realm: LOCAL_REALM,
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
            import post from "${LOCAL_REALM}/post";

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

      let model = await cards.load(`${LOCAL_REALM}/post-list`, 'isolated');
      this.set('component', model.component);
      await render(hbs`<this.component />`);
      assert.dom('h1').containsText('A blog post title');
      assert.dom('h2').containsText('May 17, 2021');

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
