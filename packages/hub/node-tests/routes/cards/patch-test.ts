import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { expect } from 'chai';
import { configureHubWithCompiler } from '../../helpers/cards';

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

    let { realmURL, request, cards } = configureHubWithCompiler(this);

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
            import date from "https://cardstack.com/base/date";
            export default class Post {
              @contains(string)
              title;
              @contains(string)
              body;
              @contains(date)
              createdAt;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate(
            '<h1><@fields.title/></h1><article><@fields.createdAt/><@fields.body/></article>'
          ),
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'post0',
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
          createdAt: '1976-08-27',
        },
      });
    });

    it('returns a 404 when trying to update from a card that doesnt exist', async function () {
      // assert.expect(0);
      await updateCard(`${realmURL}car0`, {
        data: {
          vin: '123',
        },
      }).expect(404);
    });

    it('can update an existing data only card', async function () {
      let initialResponse = await updateCard(`${realmURL}post0`, {
        data: {
          attributes: {
            title: 'Goodbye World!',
            body: 'First post',
            createdAt: '2019-10-30',
          },
        },
      }).expect(200);
      expect(initialResponse.body.data.attributes).to.deep.equal(
        {
          title: 'Goodbye World!',
          body: 'First post',
          createdAt: '2019-10-30',
        },
        'PATCH Response'
      );

      let response = await getCard(`${realmURL}post0`).expect(200);
      expect(response.body.data?.attributes).to.deep.equal(
        {
          title: 'Goodbye World!',
          body: 'First post',
          createdAt: '2019-10-30',
        },
        'Followup Request'
      );
    });

    it('can update a card that has a schema file', async function () {
      let attributes = {
        title: 'Placeholder Title',
        body: 'Placeholder Body',
      };
      let initialResponse = await updateCard(`${realmURL}post`, {
        data: {
          attributes,
        },
      }).expect(200);
      expect(initialResponse.body.data.attributes).to.deep.equal(attributes, 'PATCH response');

      let response = await getCard(`${realmURL}post`).expect(200);
      expect(response.body.data?.attributes).to.deep.equal(attributes, 'Followup Request');
    });
  });
}
