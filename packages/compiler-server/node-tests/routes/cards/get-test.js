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
describe('GET /cards/<card-id>', function () {
    let realm;
    let server;
    function getCard(cardURL) {
        return supertest_1.default(server.callback()).get(`/cards/${encodeURIComponent(cardURL)}`);
    }
    let { resolveCard, getCardCacheDir } = cache_1.setupCardCache(this);
    let { createRealm, getRealmManager } = realm_1.setupRealms(this);
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
        import datetime from "https://cardstack.com/base/datetime";
        export default class Post {
          @contains(string) title;
          @contains(string) body;
          @contains(datetime) createdAt;
          @contains(string) extra;
        }
      `,
            'isolated.js': templates_1.templateOnlyComponentTemplate('<h1><@fields.title/></h1><article><@fields.body/></article>'),
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
        server = (await server_1.Server.create({
            cardCacheDir: getCardCacheDir(),
            realms: getRealmManager(),
        })).app;
    });
    it("404s when you try to load a card outside of it's realm", async function () {
        // assert.expect(0);
        await getCard('https://some-other-origin.com/thing').expect(404);
    });
    it("can load a simple isolated card's data", async function () {
        var _a, _b, _c;
        let response = await getCard('https://my-realm/post0').expect(200);
        chai_1.expect(response.body).to.have.all.keys('data');
        chai_1.expect(response.body.data).to.have.all.keys('type', 'id', 'meta', 'attributes');
        chai_1.expect((_a = response.body.data) === null || _a === void 0 ? void 0 : _a.attributes).to.deep.equal({
            title: 'Hello World',
            body: 'First post.',
        });
        chai_1.expect((_b = response.body.data) === null || _b === void 0 ? void 0 : _b.meta.componentModule).to.not.be.undefined;
        let componentModule = (_c = response.body.data) === null || _c === void 0 ? void 0 : _c.meta.componentModule;
        chai_1.expect(componentModule, 'should have componentModule').to.not.be.undefined;
        chai_1.expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
    });
});
//# sourceMappingURL=get-test.js.map