"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const utils_1 = require("@cardstack/core/src/utils");
const supertest_1 = __importDefault(require("supertest"));
const templates_1 = require("@cardstack/core/tests/helpers/templates");
const cache_1 = require("@cardstack/compiler-server/node-tests/helpers/cache");
const realm_1 = require("@cardstack/compiler-server/node-tests/helpers/realm");
const server_1 = require("@cardstack/compiler-server/src/server");
const fs_extra_1 = require("fs-extra");
const chai_1 = require("chai");
describe('DELETE /cards/<card-id>', function () {
    let realm;
    let server;
    function getCard(cardURL) {
        return supertest_1.default(server.callback()).get(`/cards/${encodeURIComponent(cardURL)}`);
    }
    function deleteCard(cardURL) {
        return supertest_1.default(server.callback()).del(`/cards/${encodeURIComponent(cardURL)}`);
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
    it('returns a 404 when trying to delete from a card that doesnt exist', async function () {
        // assert.expect(0);
        await deleteCard('https://my-realm/car0').expect(404);
    });
    it('can delete an existing card that has no children', async function () {
        // assert.expect(2);
        await deleteCard('https://my-realm/post0').expect(204);
        await getCard('https://my-realm/post0').expect(404);
        chai_1.expect(fs_extra_1.existsSync(path_1.join(getCardCacheDir(), 'node', utils_1.encodeCardURL('https://my-realm/post0'))), 'Cache for card is deleted').to.be.false;
        chai_1.expect(fs_extra_1.existsSync(path_1.join(realm.directory, 'post0')), 'card is deleted from realm').to.be.false;
    });
});
//# sourceMappingURL=delete-test.js.map