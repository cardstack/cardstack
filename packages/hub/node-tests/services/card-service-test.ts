import { expect } from 'chai';
import { setupServer } from '../helpers/server';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';

if (process.env.COMPILER) {
  describe.skip('CardService', function () {
    let { cards, realm } = setupServer(this);

    this.beforeEach(async function () {
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

    it(`can filter on a card's own fields using eq`, async function () {
      let matching = await cards.query({
        filter: { type: `${realm}post`, range: { createdAt: { gt: '2019-01-01' } } },
      });
      expect(matching.map((m) => m.compiled.url)).to.have.members([`${realm}post1`]);
    });
  });
}
