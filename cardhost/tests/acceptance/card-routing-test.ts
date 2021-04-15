import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import setupCardMocking from '../helpers/card-mocking';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { templateOnlyComponentTemplate } from '../helpers/template-compiler';

module('Acceptance | card routing', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  setupCardMocking(hooks);

  hooks.beforeEach(function () {
    // TODO
    this.server.create('space', {
      id: 'home',
      routingCard: 'https://mirage/cards/my-routes',
    });

    this.createCard({
      url: 'https://mirage/cards/my-routes',
      files: {
        'schema.js': `
          export default class MyRoutes {
            routeTo(path) {
              if (path === '/welcome') {
                return 'https://mirage/cards/person';
              }
            }
          }`,
      },
    });
    this.createCard({
      url: 'https://mirage/cards/person',
      isolated: 'isolated.js',
      data: {
        attributes: {
          name: 'Arthur',
        },
      },
      files: {
        'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          export default class Person {
            @contains(string)
            name;
          }`,
        'isolated.js': templateOnlyComponentTemplate(
          `<div data-test-person>Hi! I am <@model.name/></div>`
        ),
      },
    });
  });

  test('visiting /card-routing', async function (assert) {
    await visit('/welcome');
    assert.equal(currentURL(), '/welcome');
    assert.dom('[data-test-person]').containsText('Hi! I am Arthur');
  });
});
