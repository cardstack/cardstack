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
            export default class Post {
              @contains(person) author;
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
          },
        },
      });
    });

    describe('.load()', function () {
      it('returns a card thats been indexed', async function () {
        let card = await cards.load(`${realmURL}post1`);
        expect(card.content.data.title).to.eq('Hello again');
        expect(card.compiled!.url).to.eq(`${realmURL}post1`);
        expect(card.compiled!.adoptsFrom!.url).to.eq(`${realmURL}post`);
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

    describe('.query()', function () {
      it(`can filter by card type`, async function () {
        let matching = await cards.query({
          filter: { type: `${realmURL}post` },
        });
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realmURL}post1`, `${realmURL}post0`]);
      });

      it(`can filter on a card's own fields using gt`, async function () {
        let matching = await cards.query({
          filter: { on: `${realmURL}post`, range: { views: { gt: 7 } } },
        });
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realmURL}post0`]);
      });

      it(`gives a good error when query refers to missing card`, async function () {
        try {
          await cards.query({
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
          await cards.query({
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
        let matching = await cards.query({
          filter: {
            on: `${realmURL}post`,
            eq: { 'author.name': 'Sue' },
          },
        });
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realmURL}post0`]);
      });

      it(`can negate a filter`, async function () {
        let matching = await cards.query({
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
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realmURL}post1`]);
      });

      it(`can combine multiple types`, async function () {
        let matching = await cards.query({
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
        expect(matching.map((m) => m.compiled.url)).to.have.members([`${realmURL}post0`, `${realmURL}book0`]);
      });
    });

    describe('create()', function () {
      it('can create a card with a linksTo field', async function () {
        let card = await cards.create({
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
        expect(card.content.data.author.name).to.equal('Sue');
        expect(card.content.data.id).to.equal('https://cardstack.local/sue');

        // NEXT steps to make this pass:
        //   The work of embedding related records (and later running computed)
        //   should happen something like this:
        //
        // let updater = new Updater(modules: Omit<CardContent, 'data'>);
        // try {
        //   let content = await updater.run(data: RawCard["data"])
        //   let deps = updater.dependencies();
        // } catch (err: any) {
        //   let deps = updater.dependencies(); // dep tracking works even in failure
        // }
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
        let realmManager = await getContainer().lookup('realm-manager');
        let rawCard = await realmManager.read({ realm: realmURL, id: 'post1' });
        expect(rawCard.adoptsFrom).to.equal('../post');
        expect(rawCard.data!.title).to.equal('Hello to you');
      });
    });
  });
}
