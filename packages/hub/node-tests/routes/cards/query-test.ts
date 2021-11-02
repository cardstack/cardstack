/* eslint-disable mocha/no-exclusive-tests */
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupServer } from '../../helpers/server';
import { map } from 'lodash';

const CS_REALM = 'https://cardstack.com/base';
const REALM = 'https://my-realm';

if (process.env.COMPILER) {
  describe.skip('GET /cards/<QUERY>', function () {
    function get(url: string) {
      return request().get(url);
    }

    let { getCardService, request } = setupServer(this, { testRealm: REALM });

    this.beforeEach(async function () {
      let cards = await getCardService();
      await cards.create({
        url: `${REALM}/pet`,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Pet {
              @contains(string) species;
            }
          `,
        },
      });

      await cards.create({
        url: `${REALM}/person`,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import pet from "https://my-realm/pet";
            export default class Person {
              @contains(string) name;
              @contains(pet) bestFriend;
            }
          `,
        },
      });

      await cards.create({
        url: `${REALM}/sue`,
        adoptsFrom: '../person',
        data: { name: 'Sue' },
      });

      await cards.create({
        url: `${REALM}/fancy-person`,
        adoptsFrom: '../person',
        isolated: 'isolated.js',
        files: {
          'isolated.js': templateOnlyComponentTemplate('<h1><@fields.name/></h1>'),
        },
      });

      await cards.create({
        url: `${REALM}/bob`,
        adoptsFrom: '../fancy-person',
        data: { name: 'Bob' },
      });

      await cards.create({
        url: `${REALM}/post`,
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import date from "https://cardstack.com/base/date";
            import person from 'https://my-realm/person';
            export default class Post {
              @contains(string) title;
              @contains(string) body;
              @contains(date) createdAt;
              @contains(string) extra;
              @contains(person) author;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate(
            '<h1><@fields.title/></h1><article><@fields.body/><@fields.author.name/><@fields.author.bestFriend.species/>/</article>'
          ),
        },
      });

      await cards.create({
        url: `${REALM}/post0`,
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
          createdAt: '2018-01-01',
          author: {
            name: 'Emily',
            bestFriend: {
              species: 'dog',
            },
          },
        },
      });

      await cards.create({
        url: `${REALM}/post1`,
        adoptsFrom: '../post',
        data: {
          title: 'Hello again',
          body: 'second post.',
          createdAt: '2020-01-01',
        },
      });
    });

    /* Query Params
      - adoptsFrom
      - realm
      - q (full text search)
    */

    // TODO: query on title field
    // TODO: query on author first name field

    it('can query for cards that are valid versions of another card', async function () {
      let response = await get(`/cards/?adoptsFrom=${REALM}/person`).expect(200);

      expect(response.body).to.have.all.keys('data');
      expect(response.body.data).to.be.an('array').and.have.lengthOf(3);
      expect(map(response.body.data, 'id')).to.deep.equal([`${REALM}/sue`, `${REALM}/bob`, `${REALM}/fancy-person`]);
      expect(response.body.data[0]).to.have.all.keys('type', 'id', 'meta', 'attributes');
      // expect(response.body.data?.meta.componentModule).to.not.be.undefined;
    });

    // TODO: Use JSONAPI filter query param for fields, but not neccessarily "system" fields like adoptsFrom
    // TODO: Data isn't the right boundary. Consider using realm instead.
    it('can query for cards that are valid versions of another card and that include data ', async function () {
      let response = await get(`/cards/?adoptsFrom=${REALM}/person&hasData=true`).expect(200);

      expect(response.body.data).to.be.an('array').and.have.lengthOf(1);
      expect(map(response.body.data, 'id')).to.deep.equal([`${REALM}/bob`, `${REALM}/sue`]);
    });

    // TODO: Rather than primitives, we will have something a "collection" in the base realm called "Default Fields"
    // On approach could be a "Default Fields" card that has a has many. Would use a jsonapi endpoint for the particular relationship
    it('can query for cards that are primitives', async function () {
      let response = await get(`/cards/?primitive=true`).expect(200);

      expect(map(response.body.data, 'id')).to.deep.equal([
        `${CS_REALM}/string`,
        `${CS_REALM}/datetime`,
        `${CS_REALM}/date`,
      ]);
    });

    it.skip('can query for cards after a certain date', async function () {
      // TODO: What would the query look like?
      let response = await get(`/cards/?=true`).expect(200);

      expect(map(response.body.data, 'id')).to.deep.equal([`${REALM}/post1`]);
    });
  });
}
