import type Koa from 'koa';
import supertest from 'supertest';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardCache } from '@cardstack/compiler-server/node-tests/helpers/cache';
import { ProjectTestRealm, setupRealms } from '@cardstack/compiler-server/node-tests/helpers/realm';
import { Server } from '@cardstack/compiler-server/src/server';
import { expect } from 'chai';

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

describe('GET /sources/<card-id>', function () {
  let realm: ProjectTestRealm;
  let server: Koa;

  function getSource(cardURL: string, params?: any) {
    let url = `/sources/${encodeURIComponent(cardURL)}`;
    if (params) {
      url += '?' + new URLSearchParams(params).toString();
    }
    return supertest(server.callback()).get(url);
  }

  let { getCardCacheDir } = setupCardCache(this);
  let { createRealm, getRealmManager } = setupRealms(this);

  this.beforeEach(async function () {
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

  it('404s when you try to load card from unknown realm', async function () {
    // assert.expect(0);
    await getSource('https://some-other-origin.com/thing').expect(404);
  });

  it('404s when you try to load missing from known realm', async function () {
    // assert.expect(0);
    await getSource('https://my-realm/thing').expect(404);
  });

  it('can get source for a card with code & schema', async function () {
    let response = await getSource('https://my-realm/post').expect(200);

    expect(response.body, 'data is the only top level key').to.have.all.keys(['data']);
    expect(response.body.data).to.have.all.keys(['id', 'type', 'attributes', 'relationships']);
    expect(response.body.data?.attributes).to.deep.equal({
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

  it('can get source for a card with only data', async function () {
    let response = await getSource('https://my-realm/post0').expect(200);

    expect(response.body, 'data is the only top level key').to.have.all.keys(['data']);
    expect(response.body.data).to.have.all.keys(['id', 'type', 'attributes', 'relationships']);
    expect(response.body.data?.attributes).to.deep.equal({
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

  it('can include compiled meta', async function () {
    let response = await getSource('https://my-realm/post0', {
      include: 'compiledMeta',
    }).expect(200);

    expect(response.body.data.relationships?.compiledMeta).to.deep.equal({
      data: {
        type: 'compiled-metas',
        id: 'https://my-realm/post0',
      },
    });

    let compiledMeta = response.body.included?.find(
      (ref: any) => ref.type === 'compiled-metas' && ref.id === 'https://my-realm/post0'
    );

    expect(compiledMeta?.attributes).to.have.all.keys(['schemaModule', 'serializer', 'isolated', 'embedded', 'edit']);

    expect(compiledMeta?.relationships).to.deep.equal({
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

    expect(post, 'found rawCard.compiledMeta.adoptsFrom').to.be.ok;

    let title = response.body.included?.find(
      (ref: any) => ref.type === 'fields' && ref.id === 'https://my-realm/post0/title'
    );

    expect(title, 'found title field').to.be.ok;
  });
});
