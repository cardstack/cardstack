import type Koa from 'koa';
import supertest from 'supertest';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardCache } from '@cardstack/compiler-server/node-tests/helpers/cache';
import { ProjectTestRealm, setupRealms } from '@cardstack/compiler-server/node-tests/helpers/realm';
import { Server } from '@cardstack/compiler-server/src/server';
import { expect } from 'chai';

describe('GET /cards/<card-id>', function () {
  let realm: ProjectTestRealm;
  let server: Koa;

  function getCard(cardURL: string) {
    return supertest(server.callback()).get(`/cards/${encodeURIComponent(cardURL)}`);
  }

  let { resolveCard, getCardCacheDir } = setupCardCache(this);
  let { createRealm, getRealmManager } = setupRealms(this);

  this.beforeEach(async function () {
    realm = createRealm('https://my-realm');
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
      'isolated.js': templateOnlyComponentTemplate('<h1><@fields.title/></h1><article><@fields.body/></article>'),
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

  it("404s when you try to load a card outside of it's realm", async function () {
    // assert.expect(0);
    await getCard('https://some-other-origin.com/thing').expect(404);
  });

  it("can load a simple isolated card's data", async function () {
    let response = await getCard('https://my-realm/post0').expect(200);

    expect(response.body).to.have.all.keys('data');
    expect(response.body.data).to.have.all.keys('type', 'id', 'meta', 'attributes');
    expect(response.body.data?.attributes).to.deep.equal({
      title: 'Hello World',
      body: 'First post.',
    });
    expect(response.body.data?.meta.componentModule).to.not.be.undefined;

    let componentModule = response.body.data?.meta.componentModule;
    expect(componentModule, 'should have componentModule').to.not.be.undefined;
    expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
  });
});
