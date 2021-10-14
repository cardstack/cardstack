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
describe('PATCH /cards/<card-id>', function () {
    let realm;
    let server;
    function getCard(cardURL) {
        return supertest_1.default(server.callback()).get(`/cards/${encodeURIComponent(cardURL)}`);
    }
    function updateCard(cardURL, payload) {
        return supertest_1.default(server.callback())
            .patch(`/cards/${encodeURIComponent(cardURL)}`)
            .set('Accept', 'application/json')
            .send(payload)
            .expect('Content-Type', /json/);
    }
    let { getCardCacheDir } = cache_1.setupCardCache(this);
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
        export default class Post {
          @contains(string)
          title;
          @contains(string)
          body;
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
    it('returns a 404 when trying to update from a card that doesnt exist', async function () {
        // assert.expect(0);
        await updateCard('https://my-realm/car0', {
            data: {
                vin: '123',
            },
        }).expect(404);
    });
    it('can update an existing card', async function () {
        var _a;
        let initialResponse = await updateCard('https://my-realm/post0', {
            data: {
                attributes: {
                    title: 'Goodbye World!',
                    body: 'First post',
                },
            },
        }).expect(200);
        chai_1.expect(initialResponse.body.data.attributes).to.deep.equal({
            title: 'Goodbye World!',
            body: 'First post',
        });
        let response = await getCard('https://my-realm/post0').expect(200);
        chai_1.expect((_a = response.body.data) === null || _a === void 0 ? void 0 : _a.attributes).to.deep.equal({
            title: 'Goodbye World!',
            body: 'First post',
        });
    });
});
//# sourceMappingURL=patch-test.js.map