import { join } from 'path';
import { encodeCardURL } from '@cardstack/core/src/utils';
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
import { existsSync } from 'fs-extra';

QUnit.module('DELETE /cards/<card-id>', function (hooks) {
  let realm: ProjectTestRealm;
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

  let { getCardCacheDir } = setupCardCache(hooks);
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
        realmConfigs: getRealmConfigs(),
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
      assert.expect(2);

      await deleteCard('https://my-realm/post0').expect(204);
      await getCard('https://my-realm/post0').expect(404);

      assert.notOk(
        existsSync(
          join(
            getCardCacheDir(),
            'node',
            encodeCardURL('https://my-realm/post0')
          )
        ),
        'Cache for card is deleted'
      );

      assert.notOk(
        existsSync(join(realm.directory, 'post0')),
        'card is deleted from realm'
      );
    }
  );
});
