import type Koa from 'koa';
import supertest from 'supertest';
import QUnit from 'qunit';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardCache } from '@cardstack/compiler-server/tests/helpers/cache';
import { ProjectTestRealm, setupRealms } from '@cardstack/compiler-server/tests/helpers/realm';
import { Server } from '@cardstack/compiler-server/src/server';

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
  'isolated.js': templateOnlyComponentTemplate('<h1><@fields.title/></h1><article><@fields.body/></article>'),
});

QUnit.module('GET /sources/<card-id>', function (hooks) {
  let realm: ProjectTestRealm;
  let server: Koa;

  function getSource(cardURL: string, params?: any) {
    let url = `/sources/${encodeURIComponent(cardURL)}`;
    if (params) {
      url += '?' + new URLSearchParams(params).toString();
    }
    return supertest(server.callback()).get(url);
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

  QUnit.test('404s when you try to load card from unknown realm', async function (assert) {
    assert.expect(0);
    await getSource('https://some-other-origin.com/thing').expect(404);
  });

  QUnit.test('404s when you try to load missing from known realm', async function (assert) {
    assert.expect(0);
    await getSource('https://my-realm/thing').expect(404);
  });

  QUnit.test('can get source for a card with code & schema', async function (assert) {
    let response = await getSource('https://my-realm/post').expect(200);

    assert.deepEqual(Object.keys(response.body), ['data'], 'data is the only top level key');
    assert.deepEqual(Object.keys(response.body.data), ['id', 'type', 'attributes', 'relationships']);
    assert.deepEqual(response.body.data?.attributes, {
      files: postFiles,
      isolated: 'isolated.js',
      schema: 'schema.js',
      embedded: null,
      edit: null,
      deserializer: null,
      adoptsFrom: null,
      data: null,
    });
  });

  QUnit.test('can get source for a card with only data', async function (assert) {
    let response = await getSource('https://my-realm/post0').expect(200);

    assert.deepEqual(Object.keys(response.body), ['data'], 'data is the only top level key');
    assert.deepEqual(Object.keys(response.body.data), ['id', 'type', 'attributes', 'relationships']);
    assert.deepEqual(response.body.data?.attributes, {
      files: {},
      isolated: null,
      schema: null,
      embedded: null,
      edit: null,
      deserializer: null,
      adoptsFrom: '../post',
      data: { title: 'Hello World', body: 'First post.' },
    });
  });

  QUnit.test('can include compiled meta', async function (assert) {
    let response = await getSource('https://my-realm/post0', {
      include: 'compiledMeta',
    }).expect(200);

    assert.deepEqual(response.body.data.relationships?.compiledMeta, {
      data: {
        type: 'compiled-metas',
        id: 'https://my-realm/post0',
      },
    });

    let compiledMeta = response.body.included?.find(
      (ref: any) => ref.type === 'compiled-metas' && ref.id === 'https://my-realm/post0'
    );

    assert.deepEqual(Object.keys(compiledMeta?.attributes), [
      'schemaModule',
      'serializer',
      'isolated',
      'embedded',
      'edit',
    ]);

    assert.deepEqual(compiledMeta?.relationships, {
      adoptsFrom: {
        data: {
          type: 'compiled-metas',
          id: 'https://my-realm/post',
        },
      },
      fields: {
        data: [
          {
            type: 'fields',
            id: 'https://my-realm/post0/title',
          },
          {
            type: 'fields',
            id: 'https://my-realm/post0/body',
          },
          {
            type: 'fields',
            id: 'https://my-realm/post0/createdAt',
          },
          {
            type: 'fields',
            id: 'https://my-realm/post0/extra',
          },
        ],
      },
    });

    let post = response.body.included?.find(
      (ref: any) => ref.type === 'compiled-metas' && ref.id === 'https://my-realm/post'
    );

    assert.ok(post, 'found rawCard.compiledMeta.adoptsFrom');

    let title = response.body.included?.find(
      (ref: any) => ref.type === 'fields' && ref.id === 'https://my-realm/post0/title'
    );

    assert.ok(title, 'found title field');
  });
});
