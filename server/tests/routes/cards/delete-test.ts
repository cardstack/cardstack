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

QUnit.module('DELETE /cards/<card-id>', function (hooks) {
  let realm: RealmHelper;
  let server: Koa;

  function getCard(cardURL: string) {
    return supertest(server.callback()).get(
      `/cards/${encodeURIComponent(cardURL)}`
    );
  }

  function deleteCard(cardURL: string) {
    return supertest(server.callback()).del(
      `/cards/${encodeURIComponent(cardURL)}`
    );
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
        '<h1><@model.title/></h1><article><@model.body/></article>'
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
    'returns a 404 when trying to delete from a card that doesnt exist',
    async function (assert) {
      assert.expect(0);
      await deleteCard('https://my-realm/car0').expect(404);
    }
  );

  QUnit.test(
    'can delete an existing card that has no children',
    async function (assert) {
      assert.expect(0);
      await deleteCard('https://my-realm/post0').expect(204);
      await getCard('https://my-realm/post0').expect(404);
      // TODO: Assert file doesn't exist in cache or realm
    }
  );

  QUnit.test('cannot delete a card that has children', async function (assert) {
    assert.expect(0);
    await deleteCard('https://my-realm/post').expect({
      errors: [
        {
          status: 400,
          title:
            'Cannot delete "https://my-realm/post" because it has cards that adopt from it',
        },
      ],
    });
  });
});
