import { expect } from 'chai';
import { setupHub } from '../helpers/server';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';

if (process.env.COMPILER) {
  describe('CardService', function () {
    this.afterEach(async function () {
      let si = await getContainer().lookup('searchIndex');
      await si.reset();
    });
    let { getContainer, cards, realm } = setupHub(this);

    this.beforeEach(async function () {
      let si = await getContainer().lookup('searchIndex');
      await si.reset();
      await si.indexAllRealms();
    });

    this.beforeEach(async function () {
      await cards.create({
        url: `${realm}person`,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Person {
              @contains(string) name;
            }
          `,
        },
      });

      await cards.create({
        url: `${realm}sue`,
        adoptsFrom: '../person',
        data: { name: 'Sue' },
      });

      await cards.create({
        url: `${realm}dated`,
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
        url: `${realm}something-else-dated`,
        adoptsFrom: '../dated',
        data: {
          createdAt: new Date(2018, 0, 1),
        },
      });

      await cards.create({
        url: `${realm}post`,
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
        url: `${realm}post0`,
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
        url: `${realm}post1`,
        adoptsFrom: '../post',
        data: {
          title: 'Hello again',
          body: 'second post.',
          createdAt: new Date(2020, 0, 1),
          views: 5,
        },
      });

      await cards.create({
        url: `${realm}book`,
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import person from "../person";
            export default class Post {
              @contains(person) author;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate('<@field.author.name />'),
        },
      });

      await cards.create({
        url: `${realm}book0`,
        adoptsFrom: '../book',
        data: {
          author: {
            name: 'Sue',
          },
        },
      });
    });

    describe('.load()', function () {
      it('returns a card thats been indexed', async function () {
        let card = await cards.load(`${realm}post1`);
        expect(card.data!.title).to.eq('Hello again');
        expect(card.compiled!.url).to.eq(`${realm}post1`);
        expect(card.compiled!.adoptsFrom!.url).to.eq(`${realm}post`);
      });

      it('handles missing card', async function () {
        try {
          await cards.load(`${realm}nonexistent`);
          throw new Error('should have thrown exception');
        } catch (err: any) {
          expect(err.message).to.eq('Card https://cardstack.local/nonexistent was not found');
          expect(err.status).to.eq(404);
        }
      });
    });

    describe('.query()', function () {
      it(`can filter by card type`, async function () {
        let matching = await cards.query({
          filter: { type: `${realm}post` },
        });
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realm}post1`, `${realm}post0`]);
      });

      it(`can filter on a card's own fields using gt`, async function () {
        let matching = await cards.query({
          filter: { on: `${realm}post`, range: { views: { gt: 7 } } },
        });
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realm}post0`]);
      });

      it(`gives a good error when query refers to missing card`, async function () {
        try {
          await cards.query({
            filter: { on: `${realm}nonexistent`, eq: { nonExistentField: 'hello' } },
          });
          throw new Error('failed to throw expected exception');
        } catch (err: any) {
          expect(err.message).to.eq(`Your filter refers to nonexistent card ${realm}nonexistent`);
          expect(err.status).to.eq(400);
        }
      });

      it(`gives a good error when query refers to missing field`, async function () {
        try {
          await cards.query({
            filter: { on: `${realm}post`, eq: { 'author.nonExistentField': 'hello' } },
          });
          throw new Error('failed to throw expected exception');
        } catch (err: any) {
          expect(err.message).to.eq(
            `Your filter refers to nonexistent field "nonExistentField" in card ${realm}person`
          );
          expect(err.status).to.eq(400);
        }
      });

      it(`can filter on a nested field using eq`, async function () {
        let matching = await cards.query({
          filter: {
            on: `${realm}post`,
            eq: { 'author.name': 'Sue' },
          },
        });
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realm}post0`]);
      });

      it(`can negate a filter`, async function () {
        let matching = await cards.query({
          filter: {
            every: [
              {
                type: `${realm}post`,
              },
              {
                on: `${realm}post`,
                not: {
                  eq: { 'author.name': 'Sue' },
                },
              },
            ],
          },
        });
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realm}post1`]);
      });

      it(`can combine multiple types`, async function () {
        let matching = await cards.query({
          filter: {
            any: [
              {
                on: `${realm}post`,
                eq: { 'author.name': 'Sue' },
              },
              {
                on: `${realm}book`,
                eq: { 'author.name': 'Sue' },
              },
            ],
          },
        });
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realm}post0`, `${realm}book0`]);
      });
    });

    describe('update()', function () {
      it('can update a card that is only data correctly', async function () {
        // Intentionally not including the adopts from because cardhost cardService
        // doesn't include it
        await cards.update({
          url: `${realm}post1`,
          data: {
            title: 'Hello to you',
            body: 'second post.',
            createdAt: new Date(2020, 0, 1),
          },
        });
        let realmManager = await getContainer().lookup('realm-manager');
        let rawCard = await realmManager.read(`${realm}post1`);
        expect(rawCard.adoptsFrom).to.equal('../post');
        expect(rawCard.data!.title).to.equal('Hello to you');
      });
    });
  });
}
