import { module, test, skip } from 'qunit';
import { setupCardTest } from '../helpers/setup';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import fillIn from '@ember/test-helpers/dom/fill-in';
import find from '@ember/test-helpers/dom/find';
import waitUntil from '@ember/test-helpers/wait-until';

module('Integration | Card Rendering', function (hooks) {
  let { createCard, renderCard, localRealmURL } = setupCardTest(hooks);

  test(`load a cards isolated component`, async function (assert) {
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
    await renderCard({ id: 'post-1' });

    assert.dom('h1').containsText('A blog post title');
    assert.dom('h2').containsText('Mar 2, 2021');
  });

  test('Can render a synchronous computed field', async function (assert) {
    createCard({
      id: 'bob',
      realm: localRealmURL,
      schema: 'schema.js',
      isolated: 'isolated.js',
      data: {
        firstName: 'Bob',
      },
      files: {
        'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";

          export default class Hello {
            @contains(string)
            firstName;

            @contains(string)
            get foodPref() {
              return this.firstName + " likes pizza";
            }
          }
        `,
        'isolated.js': templateOnlyComponentTemplate(
          `<h1><@fields.firstName /></h1><p><@fields.foodPref /></p>`
        ),
      },
    });

    await renderCard({ id: 'bob' });

    assert.dom('h1').containsText('Bob');
    assert.dom('p').containsText('Bob likes pizza');
  });

  test('Can render an async computed field', async function (assert) {
    createCard({
      id: 'bob',
      realm: localRealmURL,
      schema: 'schema.js',
      isolated: 'isolated.js',
      data: {
        firstName: 'Bob',
      },
      files: {
        'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";

          export default class Hello {
            @contains(string)
            firstName;

            @contains(string, { computeVia: "computeFoodPref" }) foodPref;
            async computeFoodPref() {
              await new Promise(resolve => setTimeout(resolve, 10));
              return this.firstName + " likes pizza";
            }

            @contains(string)
            get loudFoodPref() {
              return this.foodPref + "!";
            }
          }
        `,
        'isolated.js': templateOnlyComponentTemplate(
          `<h1><@fields.firstName /></h1><p><@fields.loudFoodPref /></p>`
        ),
      },
    });

    await renderCard({ id: 'bob' });

    assert.dom('h1').containsText('Bob');
    assert.dom('p').containsText('Bob likes pizza!');
  });

  test('Can rerender a computed field when edited', async function (assert) {
    createCard({
      id: 'bob',
      realm: localRealmURL,
      schema: 'schema.js',
      isolated: 'isolated.js',
      edit: 'edit.js',
      data: {
        firstName: 'Bob',
      },
      files: {
        'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";

          export default class Hello {
            @contains(string)
            firstName;

            @contains(string, { computeVia: "computeFoodPref" }) foodPref;
            async computeFoodPref() {
              await new Promise(resolve => setTimeout(resolve, 10));
              return this.firstName + " likes pizza";
            }

            @contains(string)
            get loudFoodPref() {
              return this.foodPref + "!";
            }
          }
        `,
        'isolated.js': templateOnlyComponentTemplate(
          `<h1><@fields.firstName data-test-field-name /></h1><p><@fields.loudFoodPref /></p>`
        ),
        'edit.js': templateOnlyComponentTemplate(
          `<div>Name: <@fields.firstName /></div><div data-test-field="loudFoodPref"><@fields.loudFoodPref /></div>`
        ),
      },
    });

    await renderCard({ id: 'bob' }, 'edit');
    await fillIn('[data-test-field-name]', 'Kirito');

    await waitUntil(() =>
      find('[data-test-field=loudFoodPref]')!.textContent?.includes(
        'Kirito likes pizza!'
      )
    );

    assert
      .dom('[data-test-field=loudFoodPref]')
      .containsText('Kirito likes pizza!');
  });
});
