import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import setupCardMocking from '../helpers/card-mocking';
import { setupMirage } from 'ember-cli-mirage/test-support';

module('Acceptance | card routing', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  setupCardMocking(hooks);

  hooks.beforeEach(function () {
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
      files: {
        'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/models/string";
          export default class Person {
            @contains(string)
            name;
          }`,
        'data.json': {
          attributes: {
            name: 'Arthur',
          },
        },
        'isolated.hbs': `<div data-test-person>Hi! I am <@model.name/></div>`,
      },
    });
    this.createCard({
      url: 'https://mirage/cards/welcome',
      files: {
        'schema.js': `export default class Welcome { }`,
        'isolated.hbs': `
          <h1>Welcome to the world wide web!</h1>
          <img src="https://media.giphy.com/media/ypqHf6pQ5kQEg/source.gif" />
          <p>Internet!</p>
        `,
      },
    });
  });

  test('visiting /card-routing', async function (assert) {
    await visit('/welcome');
    assert.equal(currentURL(), '/welcome');
    await this.pauseTest();
    assert.dom('[data-test-person]').containsText('Hi I am Arthur');
  });
});
