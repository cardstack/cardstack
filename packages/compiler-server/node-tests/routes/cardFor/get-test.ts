import type Koa from 'koa';
import supertest from 'supertest';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardCache } from '@cardstack/compiler-server/node-tests/helpers/cache';
import { ProjectTestRealm, setupRealms } from '@cardstack/compiler-server/node-tests/helpers/realm';
import { Server } from '@cardstack/compiler-server/src/server';
import { expect } from 'chai';

describe('GET /cardFor/<path>', function () {
  let realm: ProjectTestRealm;
  let server: Koa;

  function getCardForPath(path: string) {
    return supertest(server.callback()).get(`/cardFor/${path}`);
  }

  let { resolveCard, getCardCacheDir } = setupCardCache(this);
  let { createRealm, getRealmManager } = setupRealms(this);

  this.beforeEach(async function () {
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
      'isolated.js': templateOnlyComponentTemplate('<h1>Welcome to my homepage</h1>'),
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

  it('404s when you try to load a path that the router doesnt have', async function () {
    // assert.expect(0);
    await getCardForPath('thing').expect(404);
  });

  it("can load a simple isolated card's data", async function () {
    let response = await getCardForPath('about').expect(200);
    expect(response.body.data.id).to.equal('https://my-realm/about');
    let componentModule = response.body.data?.meta.componentModule;
    expect(componentModule, 'should have componentModule').to.not.be.undefined;
    expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
  });
});
