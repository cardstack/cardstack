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

QUnit.module('POST /cards/<card-id>', function (hooks) {
  let realm: RealmHelper;
  let server: Koa;

  function getCard(cardURL: string) {
    return supertest(server.callback()).get(
      `/cards/${encodeURIComponent(cardURL)}`
    );
  }

  function postCard(cardURL: string, payload: any) {
    return supertest(server.callback())
      .post(`/cards/${encodeURIComponent(cardURL)}`)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send(payload)
      .expect('Content-Type', /json/);
  }

  let { resolveCard, getCardCacheDir } = setupCardCache(hooks);
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
    'returns a 404 when trying to adopt from a card that doesnt exist',
    async function (assert) {
      assert.expect(0);
      await postCard('https://my-realm/car0', {
        adoptsFrom: '../car',
        data: {
          vin: '123',
        },
      }).expect(404);
    }
  );

  QUnit.test(
    'can create a new card that adopts off an another card',
    async function (assert) {
      // TODO: It's strange we decide the id from here
      // Should go to /cards/new and we figure out the ID
      let response = await postCard('https://my-realm/post0', {
        adoptsFrom: '../post',
        data: {
          title: 'Blogigidy blog',
          body: 'First post!',
        },
      }).expect(201);

      assert.deepEqual(response.body.data?.attributes, {
        title: 'Blogigidy blog',
        body: 'First post!',
      });
      let componentModule = response.body.data?.meta.componentModule;
      assert.ok(componentModule, 'should have componentModule');
      assert.ok(resolveCard(componentModule), 'component module is resolvable');

      await getCard(response.body.data.id).expect(200);
    }
  );

  QUnit.test(
    '404s when you try to post a card that adopts from a non-existent card',
    async function (assert) {
      assert.expect(0);
      await postCard('https://my-realm/post0', {
        adoptsFrom: '../pizza',
        data: {
          title: 'Hello World',
        },
      }).expect(404);
    }
  );

  QUnit.test(
    'Errors when you try to include other fields',
    async function (assert) {
      assert.expect(0);
      await postCard('https://my-realm/post0', {
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
        },
        isolated: 'isolated.js',
      })
        .expect(400)
        .expect({
          errors: [
            {
              status: 400,
              title: 'Payload contains keys that we do not allow: "isolated"',
            },
          ],
        });
    }
  );

  QUnit.test(
    'errors when you try to post attributes that dont exist on parent card',
    async function (assert) {
      assert.expect(0);
      await postCard('https://my-realm/post0', {
        adoptsFrom: '../post',
        data: {
          pizza: 'Hello World',
        },
      })
        .expect(400)
        .expect({
          errors: [
            {
              status: 400,
              title:
                'Field(s) "pizza" does not exist on card "https://my-realm/post0"',
            },
          ],
        });
    }
  );
});
