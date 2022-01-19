import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { expect } from 'chai';
import { configureHubWithCompiler } from '../../helpers/cards';

let e = encodeURIComponent;
if (process.env.COMPILER) {
  describe('POST /cards/<card-id>', function () {
    let { realmURL, request, cards, resolveCard } = configureHubWithCompiler(this);

    function getCard(cardURL: string) {
      return request().get(`/cards/${e(cardURL)}`);
    }

    function postCard(parentCardURL: string, payload: any) {
      // localhost/cards/https%3A%2F%2Fdemo.com%2F/https%3A%2F%2Fbase%2Fbase
      return request()
        .post(`/cards/${e(realmURL)}/${e(parentCardURL)}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(payload);
    }

    const PAYLOAD = {
      data: {
        attributes: {
          title: 'Blogigidy blog',
          body: 'First post!',
        },
      },
    };

    this.beforeEach(async function () {
      await cards.create({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Post {
              @contains(string) title;
              @contains(string) body;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate('<h1><@fields.title/></h1><article><@fields.body/></article>'),
        },
      });
    });

    it('can create a new card that adopts off an another card', async function () {
      let {
        body: { data },
      } = await postCard(`${realmURL}post`, PAYLOAD).expect(201).expect('Content-Type', /json/);

      expect(data.attributes).to.deep.equal({
        title: 'Blogigidy blog',
        body: 'First post!',
      });
      let componentModule = data.meta.componentModule;
      expect(componentModule, 'should have componentModule').to.not.be.undefined;
      expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;

      await getCard(data.id).expect(200);
    });

    it('Changes the ID every time', async function () {
      let card1 = await postCard(`${realmURL}post`, PAYLOAD).expect(201);
      let card2 = await postCard(`${realmURL}post`, PAYLOAD).expect(201);
      let card3 = await postCard(`${realmURL}post`, PAYLOAD).expect(201);

      expect(card1.body.data.id).to.not.equal(card2.body.data.id);
      expect(card1.body.data.id).to.not.equal(card3.body.data.id);
      expect(card2.body.data.id).to.not.equal(card3.body.data.id);
    });

    it('can create a new card that provides its own id', async function () {
      let { body } = await postCard(`${realmURL}post`, {
        data: Object.assign({ id: `${realmURL}post-it-note` }, PAYLOAD.data),
      }).expect(201);

      expect(body.data.id).to.be.equal(`${realmURL}post-it-note`);

      await getCard(body.data.id).expect(200);
    });

    it('Errors when you provide an ID that already exists', async function () {
      await cards.create({
        realm: realmURL,
        id: 'post-is-the-most',
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
        },
      });

      let response = await postCard(`${realmURL}post`, {
        data: Object.assign({ id: `${realmURL}post-is-the-most` }, PAYLOAD.data),
      });
      expect(response.status).to.equal(409);
    });

    it('gives good error when you try to post a card that adopts from a non-existent card', async function () {
      await postCard('https://not-created.com/post', PAYLOAD)
        .expect(422)
        .expect({
          errors: [
            {
              code: 422,
              detail: 'tried to adopt from card https://not-created.com/post but it failed to load',
              title: 'Unprocessable Entity',
            },
            {
              code: 404,
              detail: 'Card https://not-created.com/post was not found',
              title: 'Not Found',
            },
          ],
        });
    });

    it('errors when you try to post attributes that dont exist on parent card', async function () {
      // assert.expect(0);
      await postCard(`${realmURL}post`, {
        data: {
          attributes: {
            pizza: 'Hello World',
          },
        },
      }).expect(400);
    });
  });
}
