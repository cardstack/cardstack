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
let e = encodeURIComponent;
describe('POST /cards/<card-id>', function () {
    const REALM_NAME = 'https://super-realm.com';
    let realm;
    let server;
    function getCard(cardURL) {
        return supertest_1.default(server.callback()).get(`/cards/${e(cardURL)}`);
    }
    function postCard(parentCardURL, payload) {
        // localhost/cards/https%3A%2F%2Fdemo.com%2F/https%3A%2F%2Fbase%2Fbase
        return supertest_1.default(server.callback())
            .post(`/cards/${e(REALM_NAME)}/${e(parentCardURL)}`)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            .send(payload)
            .expect('Content-Type', /json/);
    }
    let { resolveCard, getCardCacheDir } = cache_1.setupCardCache(this);
    let { createRealm, getRealmManager } = realm_1.setupRealms(this);
    const PAYLOAD = {
        data: {
            attributes: {
                title: 'Blogigidy blog',
                body: 'First post!',
            },
        },
    };
    this.beforeEach(async function () {
        realm = createRealm(REALM_NAME);
        realm.addCard('post', {
            'card.json': {
                schema: 'schema.js',
                isolated: 'isolated.js',
            },
            'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";
        export default class Post {
          @contains(string) title;
          @contains(string) body;
        }
      `,
            'isolated.js': templates_1.templateOnlyComponentTemplate('<h1><@fields.title/></h1><article><@fields.body/></article>'),
        });
        // setting up a card cache directory that is also a resolvable node_modules
        // package with the appropriate exports rules
        server = (await server_1.Server.create({
            cardCacheDir: getCardCacheDir(),
            realms: getRealmManager(),
        })).app;
    });
    it('can create a new card that adopts off an another card', async function () {
        let { body: { data }, } = await postCard(`${REALM_NAME}/post`, PAYLOAD).expect(201);
        chai_1.expect(data.id).to.match(/https:\/\/super-realm.com\/post-\w{15}/);
        chai_1.expect(data.attributes).to.deep.equal({
            title: 'Blogigidy blog',
            body: 'First post!',
        });
        let componentModule = data.meta.componentModule;
        chai_1.expect(componentModule, 'should have componentModule').to.not.be.undefined;
        chai_1.expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
        await getCard(data.id).expect(200);
    });
    it('Changes the ID every time', async function () {
        let card1 = await postCard(`${REALM_NAME}/post`, PAYLOAD).expect(201);
        let card2 = await postCard(`${REALM_NAME}/post`, PAYLOAD).expect(201);
        let card3 = await postCard(`${REALM_NAME}/post`, PAYLOAD).expect(201);
        chai_1.expect(card1.body.data.id).to.not.equal(card2.body.data.id);
        chai_1.expect(card1.body.data.id).to.not.equal(card3.body.data.id);
        chai_1.expect(card2.body.data.id).to.not.equal(card3.body.data.id);
    });
    it('can create a new card that provides its own id', async function () {
        let { body } = await postCard(`${REALM_NAME}/post`, {
            data: Object.assign({ id: `${REALM_NAME}/post-it-note` }, PAYLOAD.data),
        }).expect(201);
        chai_1.expect(body.data.id).to.be.equal('https://super-realm.com/post-it-note');
        await getCard(body.data.id).expect(200);
    });
    it('Errors when you provide an ID that alreay exists', async function () {
        realm.addCard('post-is-the-most', {
            'card.json': {
                adoptsFrom: '../post',
                data: {
                    title: 'Hello World',
                    body: 'First post.',
                },
            },
        });
        let response = await postCard(`${REALM_NAME}/post`, {
            data: Object.assign({ id: `${REALM_NAME}/post-is-the-most` }, PAYLOAD.data),
        });
        chai_1.expect(response.body.errors[0].status).to.equal(409);
    });
    it('404s when you try to post a card that adopts from a non-existent card', async function () {
        // assert.expect(0);
        await postCard('https://not-created.com/post', PAYLOAD).expect(404);
    });
    it('Errors when you try to include other fields', async function () {
        // assert.expect(0);
        await postCard(`${REALM_NAME}/post`, Object.assign({ isolated: 'isolated.js' }, PAYLOAD))
            .expect(400)
            .expect({
            errors: [
                {
                    status: 400,
                    title: 'Payload contains keys that we do not allow: "isolated"',
                },
            ],
        });
    });
    it('errors when you try to post attributes that dont exist on parent card', async function () {
        // assert.expect(0);
        await postCard(`${REALM_NAME}/post`, {
            data: {
                attributes: {
                    pizza: 'Hello World',
                },
            },
        }).expect(400);
    });
});
//# sourceMappingURL=post-test.js.map