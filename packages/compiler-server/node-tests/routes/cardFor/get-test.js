"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const templates_1 = require("@cardstack/core/tests/helpers/templates");
const cache_1 = require("@cardstack/compiler-server/node-tests/helpers/cache");
const realm_1 = require("@cardstack/compiler-server/node-tests/helpers/realm");
const server_1 = require("@cardstack/compiler-server/src/server");
const chai_1 = require("chai");
describe('GET /cardFor/<path>', function () {
    let realm;
    let server;
    function getCardForPath(path) {
        return supertest_1.default(server.callback()).get(`/cardFor/${path}`);
    }
    let { resolveCard, getCardCacheDir } = cache_1.setupCardCache(this);
    let { createRealm, getRealmManager } = realm_1.setupRealms(this);
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
            'isolated.js': templates_1.templateOnlyComponentTemplate('<h1>Welcome to my homepage</h1>'),
        });
        realm.addCard('about', {
            'card.json': { isolated: 'isolated.js' },
            'isolated.js': templates_1.templateOnlyComponentTemplate('<div>I like trains</div>'),
        });
        // setting up a card cache directory that is also a resolvable node_modules
        // package with the appropriate exports rules
        server = (await server_1.Server.create({
            cardCacheDir: getCardCacheDir(),
            realms: getRealmManager(),
            routeCard: 'https://my-realm/routes',
        })).app;
    });
    it('404s when you try to load a path that the router doesnt have', async function () {
        // assert.expect(0);
        await getCardForPath('thing').expect(404);
    });
    it("can load a simple isolated card's data", async function () {
        var _a;
        let response = await getCardForPath('about').expect(200);
        chai_1.expect(response.body.data.id).to.equal('https://my-realm/about');
        let componentModule = (_a = response.body.data) === null || _a === void 0 ? void 0 : _a.meta.componentModule;
        chai_1.expect(componentModule, 'should have componentModule').to.not.be.undefined;
        chai_1.expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
    });
});
//# sourceMappingURL=get-test.js.map