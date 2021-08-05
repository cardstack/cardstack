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

QUnit.module('GET /cardFor/<path>', function (hooks) {
  let realm: ProjectTestRealm;
  let server: Koa;

  function getCardForPath(path: string) {
    return supertest(server.callback()).get(`/cardFor/${path}`);
  }

  let { resolveCard, getCardCacheDir } = setupCardCache(hooks);
  let { createRealm, getRealmManager } = setupRealms(hooks);

  hooks.beforeEach(async function () {
    realm = createRealm('https://my-realm');
    realm.addCard('routes', {
      'card.json': { schema: 'schema.js' },
      'schema.js': `
            export default class Routes {
              routeTo(path) {
                if (path === 'homepage') {
                  return 'https://my-realm/welcome';
                }
            
                if (path === 'about') {
                  return 'https://my-realm/about';
                }
              }
            }
          `,
    });
    realm.addCard('homepage', {
      'card.json': { isolated: 'isolated.js' },
      'isolated.js': templateOnlyComponentTemplate(
        '<h1>Welcome to my homepage</h1>'
      ),
    });
    realm.addCard('about', {
      'card.json': { isolated: 'isolated.js' },
      'isolated.js': templateOnlyComponentTemplate('<div>I like trains</div>'),
    });

    // setting up a card cache directory that is also a resolvable node_modules
    // package with the appropriate exports rules
    server = (
      await Server.create({
        cardCacheDir: getCardCacheDir(),
        realms: getRealmManager(),
        routeCard: 'https://my-realm/routes',
      })
    ).app;
  });

  QUnit.test(
    '404s when you try to load a path that the router doesnt have',
    async function (assert) {
      assert.expect(0);
      await getCardForPath('thing').expect(404);
    }
  );

  QUnit.test("can load a simple isolated card's data", async function (assert) {
    let response = await getCardForPath('about').expect(200);
    assert.equal(response.body.data.id, 'https://my-realm/about');
    let componentModule = response.body.data?.meta.componentModule;
    assert.ok(componentModule, 'should have componentModule');
    assert.ok(resolveCard(componentModule), 'component module is resolvable');
  });
});
