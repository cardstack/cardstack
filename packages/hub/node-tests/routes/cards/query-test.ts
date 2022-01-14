/* eslint-disable mocha/no-exclusive-tests */
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { map } from 'lodash';
import { configureHubWithCompiler } from '../../helpers/cards';

if (process.env.COMPILER) {
  describe('GET /cards/<QUERY>', function () {
    function get(url: string) {
      return request().get(url);
    }

    let { getContainer, realmURL, request, cards } = configureHubWithCompiler(this);

    this.beforeEach(async function () {
      await cards.create({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        isolated: 'isolated.js',
        embedded: 'embedded.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import integer from "https://cardstack.com/base/integer";
            import date from "https://cardstack.com/base/date";
            export default class Post {
              @contains(string) title;
              @contains(string) body;
              @contains(integer) views;
              @contains(date) createdAt;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate(
            '<h1><@fields.title/></h1><h2><@fields.createdAt/> </h2><article><@fields.body/></article>'
          ),
          'embedded.js': templateOnlyComponentTemplate('<@fields.title/>'),
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'post0',
        adoptsFrom: '../post',
        data: {
          title: 'Hello World',
          body: 'First post.',
          createdAt: new Date(2018, 0, 1),
          views: 10,
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'post1',
        adoptsFrom: '../post',
        data: {
          title: 'Hello again',
          body: 'second post.',
          createdAt: new Date(2020, 0, 1),
          views: 5,
        },
      });

      let searchIndex = await getContainer().lookup('searchIndex');
      await searchIndex.indexAllRealms();
    });

    it(`can filter on a card's own fields`, async function () {
      let response = await get(`/cards/?filter[on]=${realmURL}post&filter[range][views][gt]=7`).expect(200);

      expect(response.body).to.have.all.keys('data');
      expect(response.body.data).to.be.an('array').and.have.lengthOf(1);
      expect(map(response.body.data, 'id')).to.deep.equal([`${realmURL}post0`]);
      expect(response.body.data[0].attributes).to.deep.equal({
        title: 'Hello World',
      });
    });
  });
}
