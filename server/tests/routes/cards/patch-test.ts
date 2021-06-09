import type Koa from 'koa';
import supertest from 'supertest';
import QUnit from 'qunit';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardCache } from '@cardstack/server/tests/helpers/cache';
import {
  RealmHelper,
  setupRealms,
} from '@cardstack/server/tests/helpers/realm';
import { Server } from '@cardstack/server/src/server';

QUnit.module('PATCH /cards/<card-id>', function (hooks) {
  let realm: RealmHelper;
  let server: Koa;

  function getCard(cardURL: string) {
    return supertest(server.callback()).get(
      `/cards/${encodeURIComponent(cardURL)}`
    );
  }

  function updateCard(cardURL: string, payload: any) {
    return supertest(server.callback())
      .patch(`/cards/${encodeURIComponent(cardURL)}`)
      .set('Accept', 'application/json')
      .send(payload)
      .expect('Content-Type', /json/);
  }

  let { getCardCacheDir } = setupCardCache(hooks);
  let { createRealm, getRealms } = setupRealms(hooks);

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
        export default class Post {
          @contains(string)
          title;
          @contains(string)
          body;
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
        realms: getRealms(),
      })
    ).app;
  });

  QUnit.test(
    'returns a 404 when trying to update from a card that doesnt exist',
    async function (assert) {
      assert.expect(0);
      await updateCard('https://my-realm/car0', {
        data: {
          vin: '123',
        },
      }).expect(404);
    }
  );

  QUnit.test('can update an existing card', async function (assert) {
    let initialResponse = await updateCard('https://my-realm/post0', {
      data: {
        title: 'Goodbye World!',
        body: 'First post',
      },
    }).expect(200);
    assert.deepEqual(initialResponse.body.data.attributes, {
      title: 'Goodbye World!',
      body: 'First post',
    });

    // TODO: Our response assumes the "isolated" format, which has the component module
    // That feels odd
    let response = await getCard('https://my-realm/post0').expect(200);
    assert.deepEqual(response.body.data?.attributes, {
      title: 'Goodbye World!',
      body: 'First post',
    });
  });
});
