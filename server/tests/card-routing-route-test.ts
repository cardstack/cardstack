import type Koa from 'koa';
import { Project } from 'scenario-tester';
import supertest from 'supertest';
import QUnit from 'qunit';
import { join } from 'path';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardCache } from './helpers/cache';
import { Server } from '../src/server';

QUnit.module('respondWithCardForPath', function (hooks) {
  let realm: Project;
  let server: Koa;

  function getCardForPath(path: string) {
    return supertest(server.callback()).get(`/cardsFor/${path}`);
  }

  let { resolveCard, getCardCacheDir } = setupCardCache(hooks);

  hooks.beforeEach(async function () {
    realm = new Project('my-realm', {
      files: {
        routes: {
          'card.json': JSON.stringify({
            schema: 'schema.js',
          }),
          'schema.js': `
          export default class Routes {
            routeTo(path) {
              if (path === 'homepage') {
                return 'https://my-realm/cards/welcome';
              }
          
              if (path === 'about') {
                return 'https://my-realm/cards/about';
              }
            }
          }
          `,
        },
        homepage: {
          'card.json': JSON.stringify({
            isolated: 'isolated.js',
          }),
          'isolated.js': templateOnlyComponentTemplate(
            '<h1>Welcome to my homepage</h1>'
          ),
        },
        about: {
          'card.json': JSON.stringify({
            isolated: 'isolated.js',
          }),
          'isolated.js': templateOnlyComponentTemplate(
            '<div>I like trains</div>'
          ),
        },
      },
    });

    realm.writeSync();

    // setting up a card cache directory that is also a resolvable node_modules
    // package with the appropriate exports rules
    server = (
      await Server.create({
        cardCacheDir: getCardCacheDir(),
        realms: [
          { url: 'https://my-realm', directory: realm.baseDir },
          {
            url: 'https://cardstack.com/base',
            directory: join(__dirname, '..', '..', 'base-cards'),
          },
        ],
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
    assert.equal(response.body.data.id, 'https://myrealm/about');
    let componentModule = response.body.data?.meta.componentModule;
    assert.ok(componentModule, 'should have componentModule');
    assert.ok(resolveCard(componentModule), 'component module is resolvable');
  });
});
