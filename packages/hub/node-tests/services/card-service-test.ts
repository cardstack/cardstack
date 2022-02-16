import { expect } from 'chai';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { configureHubWithCompiler } from '../helpers/cards';

if (process.env.COMPILER) {
  describe('CardService', function () {
    let { getContainer, realmURL, cards } = configureHubWithCompiler(this);

    this.beforeEach(async function () {
      await cards.create({
        realm: realmURL,
        id: 'person',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Person {
              @contains(string) name;
              @contains(string) lname;
            }
          `,
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'sue',
        adoptsFrom: '../person',
        data: { name: 'Sue' },
      });

      await cards.create({
        realm: realmURL,
        id: 'dated',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import date from "https://cardstack.com/base/date";
            export default class Dated {
              @contains(date) createdAt;
            }
          `,
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'something-else-dated',
        adoptsFrom: '../dated',
        data: {
          createdAt: new Date(2018, 0, 1),
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'post',
        adoptsFrom: '../dated',
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import integer from "https://cardstack.com/base/integer";
            import person from "../person";
            export default class Post {
              @contains(string) title;
              @contains(string) body;
              @contains(person) author;
              @contains(integer) views;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate(
            '<h1><@fields.title/></h1><h2><@fields.createdAt/> <@field.author.name /> </h2><article><@fields.body/></article>'
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
          author: {
            name: 'Sue',
          },
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

      await cards.create({
        realm: realmURL,
        id: 'book',
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import person from "../person";
            import integer from "https://cardstack.com/base/integer";
            export default class Book {
              @contains(person) author;
              @contains(integer) editions;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate('<@field.author.name />'),
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'book0',
        adoptsFrom: '../book',
        data: {
          author: {
            name: 'Sue',
            lname: 'F',
          },
          editions: 4,
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'book1',
        adoptsFrom: '../book',
        data: {
          author: {
            name: 'Beste',
            lname: 'N',
          },
          editions: 5,
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'book2',
        adoptsFrom: '../book',
        data: {
          author: {
            name: 'Burcu',
            lname: 'N',
          },
          editions: 2,
        },
      });

      await cards.create({
        realm: realmURL,
        id: 'book3',
        adoptsFrom: '../book',
        data: {
          author: {
            name: 'Ed',
            lname: 'F',
          },
          editions: 3,
        },
      });
    });

    describe('.load() & .loadData()', function () {
      it('returns a card thats been indexed', async function () {
        let card = await cards.loadData(`${realmURL}post1`, 'isolated');
        expect(card.data.title).to.eq('Hello again');
        expect(card.url).to.eq(`${realmURL}post1`);
        let { compiled } = await cards.load(`${realmURL}post1`);
        expect(compiled.adoptsFrom!.url).to.eq(`${realmURL}post`);
      });

      it('returns a card from the base realm', async function () {
        let card = await cards.load('https://cardstack.com/base/string');
        expect(card.compiled!.url).to.eq('https://cardstack.com/base/string');
      });

      it('handles missing card', async function () {
        try {
          await cards.load(`${realmURL}nonexistent`);
          throw new Error('should have thrown exception');
        } catch (err: any) {
          expect(err.message).to.eq('Card https://cardstack.local/nonexistent was not found');
          expect(err.status).to.eq(404);
        }
      });
    });

    describe.only('.query()', function () {
      // tests for query.sort:
      // string field: ordering alphabetically, ie. ordering by author.name
      // integer field: ascending, descending
      // date field: similar to filter.gt above but a different SQL expression

      it(`can sort by string data (ascending)`, async function () {
        let matching = await cards.query('embedded', {
          sort: {
            by: 'author.name',
            on: `${realmURL}book`,
          },
          filter: {
            type: `${realmURL}book`,
          },
        });
        expect(matching.map((m) => m.url)).to.deep.equal([
          `${realmURL}book1`, // Beste
          `${realmURL}book2`, // Burcu
          `${realmURL}book3`, // Ed
          `${realmURL}book0`, // Sue
        ]);
      });

      it(`can sort by string data (descending)`, async function () {
        let matching = await cards.query('embedded', {
          sort: {
            by: 'author.name',
            on: `${realmURL}book`,
            direction: 'desc',
          },
          filter: {
            type: `${realmURL}book`,
          },
        });
        expect(matching.map((m) => m.url)).to.deep.equal([
          `${realmURL}book0`, // Sue
          `${realmURL}book3`, // Ed
          `${realmURL}book2`, // Burcu
          `${realmURL}book1`, // Beste
        ]);
      });

      it(`can sort by multiple string field conditions`, async function () {
        let matching = await cards.query('embedded', {
          sort: {
            by: ['author.lname', 'author.name'],
            on: `${realmURL}book`,
          },
          filter: {
            type: `${realmURL}book`,
          },
        });
        expect(matching.map((m) => m.url)).to.deep.equal([
          `${realmURL}book3`, // Ed F
          `${realmURL}book0`, // Sue F
          `${realmURL}book1`, // Beste N
          `${realmURL}book2`, // Burcu N
        ]);
      });

      it(`can sort by multiple string field conditions in given directions`, async function () {
        let matching = await cards.query('embedded', {
          sort: {
            by: ['author.lname', 'author.name'],
            on: `${realmURL}book`,
            direction: ['asc', 'desc'],
          },
          filter: {
            type: `${realmURL}book`,
          },
        });
        expect(matching.map((m) => m.url)).to.deep.equal([
          `${realmURL}book0`, // Sue F
          `${realmURL}book3`, // Ed F
          `${realmURL}book2`, // Burcu N
          `${realmURL}book1`, // Beste N
        ]);
      });

      it.only(`can sort by integer field`, async function () {
        let matching = await cards.query('embedded', {
          sort: {
            by: ['editions'],
            on: `${realmURL}book`,
          },
          filter: {
            type: `${realmURL}book`,
          },
        });
        expect(matching.map((m) => m.url)).to.deep.equal([
          `${realmURL}book2`, // 2
          `${realmURL}book3`, // 3
          `${realmURL}book0`, // 4
          `${realmURL}book1`, // 5
        ]);
      });

      it.only(`can sort by mixed field types`, async function () {
        let matching = await cards.query('embedded', {
          sort: {
            by: ['author.lname', 'editions'],
            on: `${realmURL}book`,
            direction: ['desc'],
          },
          filter: {
            type: `${realmURL}book`,
          },
        });
        expect(matching.map((m) => m.url)).to.deep.equal([
          `${realmURL}book2`, // N 2
          `${realmURL}book1`, // N 5
          `${realmURL}book3`, // F 3
          `${realmURL}book0`, // F 4
        ]);
      });

      it(`can filter by card type`, async function () {
        let matching = await cards.query('embedded', {
          filter: { type: `${realmURL}post` },
        });
        expect(matching.map((m) => m.url)).to.have.members([`${realmURL}post1`, `${realmURL}post0`]);
      });

      it(`can filter on a card's own fields using gt`, async function () {
        let matching = await cards.query('embedded', {
          filter: { on: `${realmURL}post`, range: { views: { gt: 7 } } },
        });
        expect(matching.map((m) => m.url)).to.have.members([`${realmURL}post0`]);
      });

      it(`gives a good error when query refers to missing card`, async function () {
        try {
          await cards.query('embedded', {
            filter: { on: `${realmURL}nonexistent`, eq: { nonExistentField: 'hello' } },
          });
          throw new Error('failed to throw expected exception');
        } catch (err: any) {
          expect(err.message).to.eq(`Your filter refers to nonexistent card ${realmURL}nonexistent`);
          expect(err.status).to.eq(400);
        }
      });

      it(`gives a good error when query refers to missing field`, async function () {
        try {
          await cards.query('embedded', {
            filter: { on: `${realmURL}post`, eq: { 'author.nonExistentField': 'hello' } },
          });
          throw new Error('failed to throw expected exception');
        } catch (err: any) {
          expect(err.message).to.eq(
            `Your filter refers to nonexistent field "nonExistentField" in card ${realmURL}person`
          );
          expect(err.status).to.eq(400);
        }
      });

      it(`can filter on a nested field using eq`, async function () {
        let matching = await cards.query('embedded', {
          filter: {
            on: `${realmURL}post`,
            eq: { 'author.name': 'Sue' },
          },
        });
        expect(matching.map((m) => m.url)).to.have.members([`${realmURL}post0`]);
      });

      it(`can negate a filter`, async function () {
        let matching = await cards.query('embedded', {
          filter: {
            every: [
              {
                type: `${realmURL}post`,
              },
              {
                on: `${realmURL}post`,
                not: {
                  eq: { 'author.name': 'Sue' },
                },
              },
            ],
          },
        });
        expect(matching.map((m) => m.url)).to.have.members([`${realmURL}post1`]);
      });

      it(`can combine multiple types`, async function () {
        let matching = await cards.query('embedded', {
          filter: {
            any: [
              {
                on: `${realmURL}post`,
                eq: { 'author.name': 'Sue' },
              },
              {
                on: `${realmURL}book`,
                eq: { 'author.name': 'Sue' },
              },
            ],
          },
        });
        expect(matching.map((m) => m.url)).to.have.members([`${realmURL}post0`, `${realmURL}book0`]);
      });
    });

    describe('create()', function () {
      it.skip('can create a card with a linksTo field', async function () {
        await cards.create({
          realm: realmURL,
          id: undefined,
          data: {
            author: 'https://cardstack.local/sue',
          },
          schema: 'schema.js',
          files: {
            'schema.js': `
               import { linksTo } from '@cardstack/types';
               import Person from 'https://cardstack.local/person';

               export default class Post {
                 @linksTo(Person)
                 author;
               }
            `,
          },
        });

        let card = await cards.loadData('https://cardstack.local/sue', 'isolated');
        expect(card.data.author.name).to.equal('Sue');
        expect(card.data.author.id).to.equal('https://cardstack.local/sue');
      });
    });

    describe('update()', function () {
      it('can update a card that is only data correctly', async function () {
        // Intentionally not including the adopts from because cardhost cardService
        // doesn't include it
        await cards.update({
          realm: realmURL,
          id: 'post1',
          data: {
            title: 'Hello to you',
            body: 'second post.',
            createdAt: new Date(2020, 0, 1),
          },
        });
        let realmManager = await getContainer().lookup('realm-manager', { type: 'service' });
        let rawCard = await realmManager.read({ realm: realmURL, id: 'post1' });
        expect(rawCard.adoptsFrom).to.equal('../post');
        expect(rawCard.data!.title).to.equal('Hello to you');
      });
    });
  });
}
