import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { expect } from 'chai';
import { setupHub } from '../../helpers/server';

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

    let { cards, request, realm } = setupHub(this);

    this.beforeEach(async function () {
      await cards.create({
        url: `${realm}post`,
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
        url: `${realm}post0`,
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
        },
      });
    });

    it('returns a 404 when trying to update from a card that doesnt exist', async function () {
      // assert.expect(0);
      await updateCard(`${realm}car0`, {
        data: {
          vin: '123',
        },
      }).expect(404);
    });

    it.skip('can update an existing data only card', async function () {
      let initialResponse = await updateCard(`${realm}post0`, {
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

      let response = await getCard(`${realm}post0`).expect(200);
      expect(response.body.data?.attributes).to.deep.equal({
        title: 'Goodbye World!',
        body: 'First post',
      });
    });

    it.skip('can update a card that has a schema file', async function () {
      let attributes = {
        title: 'Placeholder Title',
        body: 'Placeholder Body',
      };
      let initialResponse = await updateCard(`${realm}post`, {
        data: {
          attributes,
        },
      }).expect(200);
      expect(initialResponse.body.data.attributes).to.deep.equal(attributes);

      let response = await getCard(`${realm}post`).expect(200);
      expect(response.body.data?.attributes).to.deep.equal(attributes);
    });
  });
}
