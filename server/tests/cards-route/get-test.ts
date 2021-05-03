import type Koa from 'koa';
import { Project } from 'scenario-tester';
import supertest from 'supertest';
import QUnit from 'qunit';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardCache } from './helpers/cache';
import { Server } from '../src/server';
import { BASE_CARD_REALM_CONFIG } from './helpers/fixtures';

  let realm: Project;
QUnit.module('GET /cards/<card-id>', function (hooks) {
  let server: Koa;

  function getCard(cardURL: string) {
    return supertest(server.callback()).get(
      `/cards/${encodeURIComponent(cardURL)}`
    );
  }

  let { resolveCard, getCardCacheDir } = setupCardCache(hooks);

  hooks.beforeEach(async function () {
    realm = new Project('my-realm', {
      files: {
        post: {
          'card.json': JSON.stringify({
            schema: 'schema.js',
            isolated: 'isolated.js',
          }),
          'schema.js': `
      import { contains } from "@cardstack/types";
      import string from "https://cardstack.com/base/string";
      export default class Post {
        @contains(string)
        title;
        @contains(string)
        body;
      }`,
          'isolated.js': templateOnlyComponentTemplate(
            '<h1><@model.title/></h1><article><@model.body/></article>'
          ),
        },

        post0: {
          'card.json': JSON.stringify({
            adoptsFrom: '../post',
            data: {
              title: 'Hello World',
              body: 'First post.',
            },
          }),
        },
      },
    });

    realm.writeSync();

    // setting up a card cache directory that is also a resolvable node_modules
    // package with the appropriate exports rules
    server = (
      await Server.create({
        cardCacheDir: getCardCacheDir(),
        realms: [
          { url: 'https://my-realm', directory: realm.baseDir },
          BASE_CARD_REALM_CONFIG,
        ],
      })
    ).app;
  });

  QUnit.test(
    "404s when you try to load a card outside of it's realm",
    async function (assert) {
      assert.expect(0);
      await getCard('https://some-other-origin.com/thing').expect(404);
    }
  );

  QUnit.test("can load a simple isolated card's data", async function (assert) {
    let response = await getCard('https://my-realm/post0').expect(200);
    assert.deepEqual(response.body.data?.attributes, {
      title: 'Hello World',
      body: 'First post.',
    });
    let componentModule = response.body.data?.meta.componentModule;
    assert.ok(componentModule, 'should have componentModule');
    assert.ok(resolveCard(componentModule), 'component module is resolvable');
  });
});
