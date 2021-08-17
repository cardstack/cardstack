import type Koa from 'koa';
import supertest from 'supertest';
import QUnit from 'qunit';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardCache } from '@cardstack/server/tests/helpers/cache';
import {
  ProjectTestRealm,
  setupRealms,
} from '@cardstack/server/tests/helpers/realm';
import { Server } from '@cardstack/server/src/server';

let postFiles = Object.freeze({
  'schema.js': `
import { contains } from "@cardstack/types";
import string from "https://cardstack.com/base/string";
import datetime from "https://cardstack.com/base/datetime";
export default class Post {
  @contains(string) title;
  @contains(string) body;
  @contains(datetime) createdAt;
  @contains(string) extra;
}
`,
  'isolated.js': templateOnlyComponentTemplate(
    '<h1><@fields.title/></h1><article><@fields.body/></article>'
  ),
});

QUnit.module('GET /sources/<card-id>', function (hooks) {
  let realm: ProjectTestRealm;
  let server: Koa;

  function getSource(cardURL: string) {
    return supertest(server.callback()).get(
      `/sources/${encodeURIComponent(cardURL)}`
    );
  }

  let { getCardCacheDir } = setupCardCache(hooks);
  let { createRealm, getRealmManager } = setupRealms(hooks);

  hooks.beforeEach(async function () {
    realm = createRealm('https://my-realm');
    realm.addCard('post', {
      'card.json': {
        schema: 'schema.js',
        isolated: 'isolated.js',
      },
      ...postFiles,
    });

    realm.addCard('post0', {
      'card.json': {
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
        },
      },
    });

    // setting up a card cache directory that is also a resolvable node_modules
    // package with the appropriate exports rules
    server = (
      await Server.create({
        cardCacheDir: getCardCacheDir(),
        realms: getRealmManager(),
      })
    ).app;
  });

  QUnit.test(
    '404s when you try to load card from unknown realm',
    async function (assert) {
      assert.expect(0);
      await getSource('https://some-other-origin.com/thing').expect(404);
    }
  );

  QUnit.test(
    '404s when you try to load missing from known realm',
    async function (assert) {
      assert.expect(0);
      await getSource('https://my-realm/thing').expect(404);
    }
  );

  QUnit.test(
    'can get source for a card with code & schema',
    async function (assert) {
      let response = await getSource('https://my-realm/post').expect(200);

      assert.deepEqual(
        Object.keys(response.body),
        ['data'],
        'data is the only top level key'
      );
      assert.deepEqual(Object.keys(response.body.data), [
        'type',
        'id',
        'attributes',
      ]);
      assert.deepEqual(response.body.data?.attributes, {
        files: postFiles,
        isolated: 'isolated.js',
        schema: 'schema.js',
      });
    }
  );

  QUnit.test(
    'can get source for a card with only data',
    async function (assert) {}
  );

  QUnit.test('can include compiled meta', async function (assert) {});
});
