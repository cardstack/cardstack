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

QUnit.module('GET /cards/<card-id>', function (hooks) {
  let realm: ProjectTestRealm;
  let server: Koa;

  function getCard(cardURL: string) {
    return supertest(server.callback()).get(
      `/cards/${encodeURIComponent(cardURL)}`
    );
  }

  let { resolveCard, getCardCacheDir } = setupCardCache(hooks);
  let { createRealm, getRealmConfigs } = setupRealms(hooks);

  hooks.beforeEach(async function () {
    realm = createRealm('my-realm');
    realm.addCard('post', {
      'card.json': {
        schema: 'schema.js',
        isolated: 'isolated.js',
      },
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
        realmConfigs: getRealmConfigs(),
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

    assert.deepEqual(
      Object.keys(response.body),
      ['data'],
      'data is the only top level key'
    );
    assert.deepEqual(Object.keys(response.body.data), [
      'type',
      'id',
      'meta',
      'attributes',
    ]);
    assert.deepEqual(response.body.data?.attributes, {
      title: 'Hello World',
      body: 'First post.',
    });
    assert.ok(response.body.data?.meta.componentModule);

    let componentModule = response.body.data?.meta.componentModule;
    assert.ok(componentModule, 'should have componentModule');
    assert.ok(resolveCard(componentModule), 'component module is resolvable');
  });
});
