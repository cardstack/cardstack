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
let postFiles = Object.freeze({
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
describe('GET /sources/<card-id>', function () {
    let realm;
    let server;
    function getSource(cardURL, params) {
        let url = `/sources/${encodeURIComponent(cardURL)}`;
        if (params) {
            url += '?' + new URLSearchParams(params).toString();
        }
        return supertest_1.default(server.callback()).get(url);
    }
    let { getCardCacheDir } = cache_1.setupCardCache(this);
    let { createRealm, getRealmManager } = realm_1.setupRealms(this);
    this.beforeEach(async function () {
        realm = createRealm('https://my-realm');
        realm.addCard('post', Object.assign({ 'card.json': {
                schema: 'schema.js',
                isolated: 'isolated.js',
            } }, postFiles));
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
    it('404s when you try to load card from unknown realm', async function () {
        // assert.expect(0);
        await getSource('https://some-other-origin.com/thing').expect(404);
    });
    it('404s when you try to load missing from known realm', async function () {
        // assert.expect(0);
        await getSource('https://my-realm/thing').expect(404);
    });
    it('can get source for a card with code & schema', async function () {
        var _a;
        let response = await getSource('https://my-realm/post').expect(200);
        chai_1.expect(response.body, 'data is the only top level key').to.have.all.keys(['data']);
        chai_1.expect(response.body.data).to.have.all.keys(['id', 'type', 'attributes', 'relationships']);
        chai_1.expect((_a = response.body.data) === null || _a === void 0 ? void 0 : _a.attributes).to.deep.equal({
            files: postFiles,
            isolated: 'isolated.js',
            schema: 'schema.js',
            embedded: null,
            edit: null,
            deserializer: null,
            adoptsFrom: null,
            data: null,
        });
    });
    it('can get source for a card with only data', async function () {
        var _a;
        let response = await getSource('https://my-realm/post0').expect(200);
        chai_1.expect(response.body, 'data is the only top level key').to.have.all.keys(['data']);
        chai_1.expect(response.body.data).to.have.all.keys(['id', 'type', 'attributes', 'relationships']);
        chai_1.expect((_a = response.body.data) === null || _a === void 0 ? void 0 : _a.attributes).to.deep.equal({
            files: {},
            isolated: null,
            schema: null,
            embedded: null,
            edit: null,
            deserializer: null,
            adoptsFrom: '../post',
            data: { title: 'Hello World', body: 'First post.' },
        });
    });
    it('can include compiled meta', async function () {
        var _a, _b, _c, _d;
        let response = await getSource('https://my-realm/post0', {
            include: 'compiledMeta',
        }).expect(200);
        chai_1.expect((_a = response.body.data.relationships) === null || _a === void 0 ? void 0 : _a.compiledMeta).to.deep.equal({
            data: {
                type: 'compiled-metas',
                id: 'https://my-realm/post0',
            },
        });
        let compiledMeta = (_b = response.body.included) === null || _b === void 0 ? void 0 : _b.find((ref) => ref.type === 'compiled-metas' && ref.id === 'https://my-realm/post0');
        chai_1.expect(compiledMeta === null || compiledMeta === void 0 ? void 0 : compiledMeta.attributes).to.have.all.keys(['schemaModule', 'serializer', 'isolated', 'embedded', 'edit']);
        chai_1.expect(compiledMeta === null || compiledMeta === void 0 ? void 0 : compiledMeta.relationships).to.deep.equal({
            adoptsFrom: {
                data: {
                    type: 'compiled-metas',
                    id: 'https://my-realm/post',
                },
            },
            fields: {
                data: [
                    {
                        type: 'fields',
                        id: 'https://my-realm/post0/title',
                    },
                    {
                        type: 'fields',
                        id: 'https://my-realm/post0/body',
                    },
                    {
                        type: 'fields',
                        id: 'https://my-realm/post0/createdAt',
                    },
                    {
                        type: 'fields',
                        id: 'https://my-realm/post0/extra',
                    },
                ],
            },
        });
        let post = (_c = response.body.included) === null || _c === void 0 ? void 0 : _c.find((ref) => ref.type === 'compiled-metas' && ref.id === 'https://my-realm/post');
        chai_1.expect(post, 'found rawCard.compiledMeta.adoptsFrom').to.be.ok;
        let title = (_d = response.body.included) === null || _d === void 0 ? void 0 : _d.find((ref) => ref.type === 'fields' && ref.id === 'https://my-realm/post0/title');
        chai_1.expect(title, 'found title field').to.be.ok;
    });
});
//# sourceMappingURL=get-test.js.map