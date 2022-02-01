import { module, test } from 'qunit';
import { setupCardTest } from '../helpers/setup';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';

module('Integration | Card Rendering', function (hooks) {
  let { createCard, renderCard, localRealmURL } = setupCardTest(hooks);

  hooks.beforeEach(function () {
    createCard({
      id: 'post',
      realm: localRealmURL,
      schema: 'schema.js',
      isolated: 'isolated.js',
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
});
