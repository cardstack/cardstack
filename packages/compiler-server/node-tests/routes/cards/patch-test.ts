import type Koa from 'koa';
import supertest from 'supertest';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardCache } from '@cardstack/compiler-server/node-tests/helpers/cache';
import { ProjectTestRealm, setupRealms } from '@cardstack/compiler-server/node-tests/helpers/realm';
import { Server } from '@cardstack/compiler-server/src/server';
import { expect } from 'chai';

describe('PATCH /cards/<card-id>', function () {
  let realm: ProjectTestRealm;
  let server: Koa;

  function getCard(cardURL: string) {
    return supertest(server.callback()).get(`/cards/${encodeURIComponent(cardURL)}`);
  }

  function updateCard(cardURL: string, payload: any) {
    return supertest(server.callback())
      .patch(`/cards/${encodeURIComponent(cardURL)}`)
      .set('Accept', 'application/json')
      .send(payload)
      .expect('Content-Type', /json/);
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
      'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";
        export default class Post {
          @contains(string)
          title;
          @contains(string)
          body;
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

  it('returns a 404 when trying to update from a card that doesnt exist', async function () {
    // assert.expect(0);
    await updateCard('https://my-realm/car0', {
      data: {
        vin: '123',
      },
    }).expect(404);
  });

  it('can update an existing card', async function () {
    let initialResponse = await updateCard('https://my-realm/post0', {
      data: {
        attributes: {
          title: 'Goodbye World!',
          body: 'First post',
        },
      },
    }).expect(200);
    expect(initialResponse.body.data.attributes).to.deep.equal({
      title: 'Goodbye World!',
      body: 'First post',
    });

    let response = await getCard('https://my-realm/post0').expect(200);
    expect(response.body.data?.attributes).to.deep.equal({
      title: 'Goodbye World!',
      body: 'First post',
    });
  });
});
