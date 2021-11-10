/* eslint-disable mocha/no-exclusive-tests */
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupHub } from '../../helpers/server';
import { map } from 'lodash';

if (process.env.COMPILER) {
  describe('GET /cards/<QUERY>', function () {
    function get(url: string) {
      return request().get(url);
    }

    this.afterEach(async function () {
      let si = await getContainer().lookup('searchIndex');
      await si.reset();
    });

    let { cards, request, realm, getContainer } = setupHub(this);

    this.beforeEach(async function () {
      // await cards.create({
      //   url: `${realm}pet`,
      //   schema: 'schema.js',
      //   files: {
      //     'schema.js': `
      //       import { contains } from "@cardstack/types";
      //       import string from "https://cardstack.com/base/string";
      //       export default class Pet {
      //         @contains(string) species;
      //       }
      //     `,
      //   },
      // });

      // await cards.create({
      //   url: `${realm}person`,
      //   schema: 'schema.js',
      //   files: {
      //     'schema.js': `
      //       import { contains } from "@cardstack/types";
      //       import string from "https://cardstack.com/base/string";
      //       import pet from "https://my-realm/pet";
      //       export default class Person {
      //         @contains(string) name;
      //         @contains(pet) bestFriend;
      //       }
      //     `,
      //   },
      // });

      // await cards.create({
      //   url: `${realm}sue`,
      //   adoptsFrom: '../person',
      //   data: { name: 'Sue' },
      // });

      // await cards.create({
      //   url: `${realm}fancy-person`,
      //   adoptsFrom: '../person',
      //   isolated: 'isolated.js',
      //   files: {
      //     'isolated.js': templateOnlyComponentTemplate('<h1><@fields.name/></h1>'),
      //   },
      // });

      // await cards.create({
      //   url: `${realm}bob`,
      //   adoptsFrom: '../fancy-person',
      //   data: { name: 'Bob' },
      // });

      let searchIndex = await getContainer().lookup('searchIndex');
      await searchIndex.indexAllRealms();

      await cards.create({
        url: `${realm}post`,
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import date from "https://cardstack.com/base/date";
            export default class Post {
              @contains(string) title;
              @contains(string) body;
              @contains(date) createdAt;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate(
            '<h1><@fields.title/></h1><h2><@fields.createdAt/></h2><article><@fields.body/></article>'
          ),
        },
      });

      await cards.create({
        url: `${realm}post0`,
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
          createdAt: new Date(2018, 0, 1),
        },
      });

      await cards.create({
        url: `${realm}post1`,
        adoptsFrom: '../post',
        data: {
          title: 'Hello again',
          body: 'second post.',
          createdAt: new Date(2020, 0, 1),
        },
      });
    });

    /* Query Params
      - adoptsFrom
      - realm
      - q (full text search)
      - filter
    */

    it(`can filter on a card's own fields`, async function () {
      let response = await get(`/cards/?filter[type]=${realm}post`).expect(200);

      expect(response.body).to.have.all.keys('data');
      expect(response.body.data).to.be.an('array').and.have.lengthOf(3);
      expect(map(response.body.data, 'id')).to.deep.equal([`${realm}sue`, `${realm}bob`, `${realm}fancy-person`]);
      expect(response.body.data[0]).to.have.all.keys('type', 'id', 'meta', 'attributes');
      // expect(response.body.data?.meta.componentModule).to.not.be.undefined;
    });

    // it('can query for cards that are valid versions of another card', async function () {
    //   let response = await get(`/cards/?adoptsFrom=${realm}person`).expect(200);

    //   expect(response.body).to.have.all.keys('data');
    //   expect(response.body.data).to.be.an('array').and.have.lengthOf(3);
    //   expect(map(response.body.data, 'id')).to.deep.equal([`${realm}sue`, `${realm}bob`, `${realm}fancy-person`]);
    //   expect(response.body.data[0]).to.have.all.keys('type', 'id', 'meta', 'attributes');
    //   // expect(response.body.data?.meta.componentModule).to.not.be.undefined;
    // });

    // // TODO: Use JSONAPI filter query param for fields, but not neccessarily "system" fields like adoptsFrom
    // // TODO: Data isn't the right boundary. Consider using realm instead.
    // it('can query for cards that are valid versions of another card and that include data ', async function () {
    //   let response = await get(`/cards/?adoptsFrom=${realm}person&hasData=true`).expect(200);

    //   expect(response.body.data).to.be.an('array').and.have.lengthOf(1);
    //   expect(map(response.body.data, 'id')).to.deep.equal([`${realm}bob`, `${realm}sue`]);
    // });

    // // TODO: Rather than primitives, we will have something a "collection" in the base realm called "Default Fields"
    // // On approach could be a "Default Fields" card that has a has many. Would use a jsonapi endpoint for the particular relationship
    // it('can query for cards that are primitives', async function () {
    //   let response = await get(`/cards/?primitive=true`).expect(200);

    //   expect(map(response.body.data, 'id')).to.deep.equal([
    //     `${CS_REALM}/string`,
    //     `${CS_REALM}/datetime`,
    //     `${CS_REALM}/date`,
    //   ]);
    // });

    // it('can query for cards after a certain date', async function () {
    //   // TODO: What would the query look like?
    //   let response = await get(`/cards/?=true`).expect(200);

    //   expect(map(response.body.data, 'id')).to.deep.equal([`${realm}post1`]);
    // });
  });
}
