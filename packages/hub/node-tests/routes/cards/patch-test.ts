import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { expect } from 'chai';
import { setupServer } from '../../helpers/server';

if (process.env.COMPILER) {
  describe('PATCH /cards/<card-id>', function () {
    function getCard(cardURL: string) {
      return request().get(`/cards/${encodeURIComponent(cardURL)}`);
    }

    function updateCard(cardURL: string, payload: any) {
      return request()
        .patch(`/cards/${encodeURIComponent(cardURL)}`)
        .set('Accept', 'application/json')
        .send(payload)
        .expect('Content-Type', /json/);
    }

    let { cards, request, realm } = setupServer(this);

    this.beforeEach(async function () {
      await cards.create({
        url: `${realm}/post`,
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
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
          'isolated.js': templateOnlyComponentTemplate('<h1><@fields.title/></h1><article><@fields.body/></article>'),
        },
      });

      await cards.create({
        url: `${realm}/post0`,
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
        },
      });
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
      let initialResponse = await updateCard('https://my-realm/post0', {
        data: {
          attributes: {
            title: 'Goodbye World!',
            body: 'First post',
          },
        },
      }).expect(200);
      expect(initialResponse.body.data.attributes).to.deep.equal({
        title: 'Goodbye World!',
        body: 'First post',
      });

      let response = await getCard('https://my-realm/post0').expect(200);
      expect(response.body.data?.attributes).to.deep.equal({
        title: 'Goodbye World!',
        body: 'First post',
      });
    });
  });
}
