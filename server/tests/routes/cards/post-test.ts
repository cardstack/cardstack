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

let e = encodeURIComponent;

QUnit.module('POST /cards/<card-id>', function (hooks) {
  const REALM_NAME = 'https://super-realm.com';
  let realm: ProjectTestRealm;
  let server: Koa;

  function getCard(cardURL: string) {
    return supertest(server.callback()).get(`/cards/${e(cardURL)}`);
  }

  function postCard(parentCardURL: string, payload: any) {
    // localhost/cards/https%3A%2F%2Fdemo.com%2F/https%3A%2F%2Fbase%2Fbase
    return supertest(server.callback())
      .post(`/cards/${e(REALM_NAME)}/${e(parentCardURL)}`)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send(payload)
      .expect('Content-Type', /json/);
  }

  let { resolveCard, getCardCacheDir } = setupCardCache(hooks);
  let { createRealm, getRealmManager } = setupRealms(hooks);

  const PAYLOAD = {
    data: {
      attributes: {
        title: 'Blogigidy blog',
        body: 'First post!',
      },
    },
  };

  hooks.beforeEach(async function () {
    realm = createRealm(REALM_NAME);

    realm.addCard('post', {
      'card.json': {
        schema: 'schema.js',
        isolated: 'isolated.js',
      },
      'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";
        export default class Post {
          @contains(string) title;
          @contains(string) body;
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
        realms: getRealmManager(),
      })
    ).app;
  });

  QUnit.test(
    'can create a new card that adopts off an another card',
    async function (assert) {
      let {
        body: { data },
      } = await postCard(`${REALM_NAME}/post`, PAYLOAD).expect(201);

      assert.ok(
        data.id.match(/https:\/\/super-realm.com\/post-\w{15}/),
        'Generates a new ID'
      );
      assert.deepEqual(data.attributes, {
        title: 'Blogigidy blog',
        body: 'First post!',
      });
      let componentModule = data.meta.componentModule;
      assert.ok(componentModule, 'should have componentModule');
      assert.ok(resolveCard(componentModule), 'component module is resolvable');

      await getCard(data.id).expect(200);
    }
  );

  QUnit.test(
    'Detirmines the last card with schema when providing a parent card that is only data',
    async function (assert) {
      realm.addCard('post-is-the-most', {
        'card.json': {
          adoptsFrom: '../post',
          data: {
            title: 'Hello World',
            body: 'First post.',
          },
        },
      });

      let {
        body: { data },
      } = await postCard(`${REALM_NAME}/post-is-the-most`, PAYLOAD).expect(201);

      assert.ok(
        data.id.match(/https:\/\/super-realm.com\/post-\w{15}/),
        'Generates a new ID'
      );
      assert.deepEqual(data.attributes, {
        title: 'Blogigidy blog',
        body: 'First post!',
      });
      let componentModule = data.meta.componentModule;
      assert.ok(componentModule, 'should have componentModule');
      assert.ok(resolveCard(componentModule), 'component module is resolvable');

      await getCard(data.id).expect(200);
    }
  );

  QUnit.test('Changes the ID every time', async function (assert) {
    let card1 = await postCard(`${REALM_NAME}/post`, PAYLOAD).expect(201);
    let card2 = await postCard(`${REALM_NAME}/post`, PAYLOAD).expect(201);
    let card3 = await postCard(`${REALM_NAME}/post`, PAYLOAD).expect(201);

    assert.notEqual(card1.body.data.id, card2.body.data.id);
    assert.notEqual(card1.body.data.id, card3.body.data.id);
    assert.notEqual(card2.body.data.id, card3.body.data.id);
  });

  QUnit.test(
    'can create a new card that provides its own id',
    async function (assert) {
      let { body } = await postCard(`${REALM_NAME}/post`, {
        data: Object.assign({ id: `${REALM_NAME}/post-it-note` }, PAYLOAD.data),
      }).expect(201);

      assert.equal(
        body.data.id,
        'https://super-realm.com/post-it-note',
        'Uses the provided ID'
      );

      await getCard(body.data.id).expect(200);
    }
  );

  QUnit.test(
    'Errors when you provide an ID that alreay exists',
    async function (assert) {
      realm.addCard('post-is-the-most', {
        'card.json': {
          adoptsFrom: '../post',
          data: {
            title: 'Hello World',
            body: 'First post.',
          },
        },
      });

      let response = await postCard(`${REALM_NAME}/post`, {
        data: Object.assign(
          { id: `${REALM_NAME}/post-is-the-most` },
          PAYLOAD.data
        ),
      });
      assert.equal(response.body.errors[0].status, 409);
    }
  );

  QUnit.test(
    '404s when you try to post a card that adopts from a non-existent card',
    async function (assert) {
      assert.expect(0);
      await postCard('https://not-created.com/post', PAYLOAD).expect(404);
    }
  );

  QUnit.test(
    'Errors when you try to include other fields',
    async function (assert) {
      assert.expect(0);
      await postCard(
        `${REALM_NAME}/post`,
        Object.assign({ isolated: 'isolated.js' }, PAYLOAD)
      )
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
      await postCard(`${REALM_NAME}/post`, {
        data: {
          attributes: {
            pizza: 'Hello World',
          },
        },
      }).expect(400);
    }
  );
});
