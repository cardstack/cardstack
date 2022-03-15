import { ADDRESS_RAW_CARD, PERSON_RAW_CARD } from '@cardstack/core/tests/helpers';
import { expect } from 'chai';
import { outputFileSync, outputJSONSync } from 'fs-extra';
import { join } from 'path';
import { configureHubWithCompiler } from '../helpers/cards';

if (process.env.COMPILER) {
  describe('SearchIndex', function () {
    let { getRealmDir, getContainer, realmURL, cards } = configureHubWithCompiler(this);

    it(`gives a good error at load time when a card can't compile`, async function () {
      outputJSONSync(join(getRealmDir(), 'example', 'card.json'), { adoptsFrom: '../post' });
      let si = await getContainer().lookup('searchIndex', { type: 'service' });
      await si.indexAllRealms();
      try {
        await cards.load(`${realmURL}example`);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.eq(`tried to adopt from card ${realmURL}post but it failed to load`);
        expect(err.status).to.eq(422);
        let innerError = err.additionalErrors?.[0];
        expect(innerError?.message).to.eq(`Card ${realmURL}post was not found`);
        expect(innerError?.status).to.eq(404);
      }
    });

    it(`gives good error at load time when card encountered userland error during indexing`, async function () {
      outputJSONSync(join(getRealmDir(), 'boom', 'card.json'), {
        realm: realmURL,
        schema: 'schema.js',
        data: {
          willBoom: 'true',
        },
      });
      outputFileSync(
        join(getRealmDir(), 'boom', 'schema.js'),
        `
        import { contains } from '@cardstack/types';
        import string from 'https://cardstack.com/base/string';
        export default class Boom {
          @contains(string) willBoom;
          @contains(string)
          get boom() {
            if (this.willBoom === 'true') {
              throw new Error('boom');
            } else {
              return 'no boom';
            }
          }
        }
      `
      );
      let si = await getContainer().lookup('searchIndex', { type: 'service' });
      await si.indexAllRealms();

      try {
        await cards.load(`${realmURL}boom`);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.eq(`Could not load field 'boom' for card ${realmURL}boom`);
        expect(err.status).to.eq(422);
        let innerError = err.additionalErrors?.[0];
        expect(innerError?.message).to.eq(`boom`);
      }

      let dbManager = await await getContainer().lookup('database-manager');
      let db = await dbManager.getClient();
      let {
        rows: [result],
      } = await db.query(`SELECT "compileErrors" FROM cards WHERE url = '${realmURL}boom'`);
      expect(result.compileErrors).to.deep.eq({
        detail: `Could not load field 'boom' for card ${realmURL}boom`,
        isCardstackError: true,
        status: 422,
        title: 'Unprocessable Entity',
        additionalErrors: [
          {
            additionalErrors: null,
            detail: 'boom',
            isCardstackError: true,
            status: 500,
            title: 'Internal Server Error',
          },
        ],
      });
    });

    it(`recovers automatically from a bad compile once the problem is addressed`, async function () {
      outputJSONSync(join(getRealmDir(), 'example', 'card.json'), {
        adoptsFrom: '../post',
        data: { title: 'Hello World' },
      });
      let si = await getContainer().lookup('searchIndex', { type: 'service' });
      await si.indexAllRealms();

      // at this point we expect loading of `example` is broken because it's
      // missing its adoption parent. This precondition is proved by the
      // previous test.

      await cards.create({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from '@cardstack/types';
            import string from 'https://cardstack.com/base/string';
            export default class Post {
              @contains(string) title;
            }
          `,
        },
      });

      let example = await cards.loadModel(`${realmURL}example`, 'isolated');
      expect(example.data.title).to.eq('Hello World');
    });

    it(`gives good error for missing module during reindexing`, async function () {
      outputJSONSync(join(getRealmDir(), 'clip', 'card.json'), {
        realm: realmURL,
        schema: 'schema.js',
        data: { title: 'Clippy' },
      });
      outputFileSync(
        join(getRealmDir(), 'clip', 'schema.js'),
        `
        import { contains } from '@cardstack/types';
        import string from 'https://cardstack.com/base/string';
        export default class Clip {
          @contains(string) title;
        }
      `
      );

      let si = await getContainer().lookup('searchIndex', { type: 'service' });
      await si.indexAllRealms();

      let card = await cards.loadModel(`${realmURL}clip`, 'isolated');
      expect(await card.getField('title')).to.equal('Clippy');

      let dbManager = await getContainer().lookup('database-manager');
      let db = await dbManager.getClient();
      let {
        rows: [result],
      } = await db.query(`SELECT "compileErrors" FROM cards WHERE url = '${realmURL}clip'`);
      expect(result.compileErrors).to.be.null;

      outputJSONSync(join(getRealmDir(), 'clip', 'card.json'), {
        realm: realmURL,
        schema: 'schema.js',
        edit: 'edit.js',
        data: { title: 'Clipster' },
      });

      si.notify(`${realmURL}clip`, 'save');
      await si.flushNotifications();
      await cards.loadModel(`${realmURL}clip`, 'isolated');

      let {
        rows: [result2],
      } = await db.query(`SELECT "compileErrors" FROM cards WHERE url = '${realmURL}clip'`);

      expect(result2.compileErrors).to.deep.equal({
        title: 'Internal Server Error',
        detail: `card.json for ${realmURL}clip refers to non-existent module edit.js`,
        status: 500,
        additionalErrors: null,
        isCardstackError: true,
      });
    });

    it(`can invalidate a card via creation of non-existent grandparent card`, async function () {
      outputJSONSync(join(getRealmDir(), 'example', 'card.json'), {
        adoptsFrom: '../post',
      });
      outputJSONSync(join(getRealmDir(), 'grandchild', 'card.json'), {
        adoptsFrom: '../example',
        data: { title: 'Hello World' },
      });
      let si = await getContainer().lookup('searchIndex', { type: 'service' });
      await si.indexAllRealms();

      // at this point we expect loading of `grandchild` is broken
      // because it's missing its grandparent card.

      await cards.create({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from '@cardstack/types';
            import string from 'https://cardstack.com/base/string';
            export default class Post {
              @contains(string) title;
            }
          `,
        },
      });

      let grandChild = await cards.loadModel(`${realmURL}grandchild`, 'isolated');
      expect(grandChild.data.title).to.eq('Hello World');
    });

    it(`can invalidate a card via the update of an adoptsFrom card`, async function () {
      outputJSONSync(join(getRealmDir(), 'post', 'card.json'), { schema: 'schema.js' });
      outputFileSync(
        join(getRealmDir(), 'post', 'schema.js'),
        `
        import { contains } from '@cardstack/types';
        import string from 'https://cardstack.com/base/string';
        export default class Post {
          @contains(string) title;
        }
      `
      );
      outputJSONSync(join(getRealmDir(), 'example', 'card.json'), { adoptsFrom: '../post' });

      let si = await getContainer().lookup('searchIndex', { type: 'service' });
      await si.indexAllRealms();
      await cards.update({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from '@cardstack/types';
            import string from 'https://cardstack.com/base/string';
            export default class Post {
              @contains(string) title;
              @contains(string) author;
            }
          `,
        },
      });

      let example = await cards.load(`${realmURL}example`);
      expect(example.compiled.fields.author.card.url).to.eq('https://cardstack.com/base/string');
    });

    it(`can invalidate a card via the update of a field card`, async function () {
      outputJSONSync(join(getRealmDir(), 'address', 'card.json'), { schema: 'schema.js' });
      outputFileSync(join(getRealmDir(), 'address', 'schema.js'), ADDRESS_RAW_CARD.files['schema.js']);
      outputJSONSync(join(getRealmDir(), 'person', 'card.json'), { schema: 'schema.js' });
      outputFileSync(join(getRealmDir(), 'person', 'schema.js'), PERSON_RAW_CARD.files['schema.js']);

      let si = await getContainer().lookup('searchIndex', { type: 'service' });
      await si.indexAllRealms();

      // add a "country" field to the address field card and observe that the person card includes the new address field
      await cards.update({
        realm: realmURL,
        id: 'address',
        schema: 'schema.js',
        files: {
          'schema.js': `
              import { contains } from "@cardstack/types";
              import string from "https://cardstack.com/base/string";
              import date from "https://cardstack.com/base/date";

              export default class Address {
                @contains(string) street;
                @contains(string) city;
                @contains(string) state;
                @contains(string) zip;
                @contains(date) settlementDate;
                @contains(string) country;
              }
            `,
        },
      });
      let person = await cards.load(`${PERSON_RAW_CARD.realm}${PERSON_RAW_CARD.id}`);
      expect(person.compiled.fields.address.card.fields.country.card.url).to.eq('https://cardstack.com/base/string');
    });

    it(`can invalidate a card via the update of a grandparent adoptsFrom card`, async function () {
      outputJSONSync(join(getRealmDir(), 'post', 'card.json'), { schema: 'schema.js' });
      outputFileSync(
        join(getRealmDir(), 'post', 'schema.js'),
        `
        import { contains } from '@cardstack/types';
        import string from 'https://cardstack.com/base/string';
        export default class Post {
          @contains(string) title;
        }
      `
      );
      outputJSONSync(join(getRealmDir(), 'example', 'card.json'), {
        adoptsFrom: '../post',
      });
      outputJSONSync(join(getRealmDir(), 'grandchild', 'card.json'), {
        adoptsFrom: '../example',
      });

      let si = await getContainer().lookup('searchIndex', { type: 'service' });
      await si.indexAllRealms();

      // add an "author" field to the parent card and observe that the grandchild card inherits this field
      await cards.update({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from '@cardstack/types';
            import string from 'https://cardstack.com/base/string';
            export default class Post {
              @contains(string) title;
              @contains(string) author;
            }
          `,
        },
      });

      let grandchild = await cards.load(`${realmURL}grandchild`);
      expect(grandchild.compiled.fields.author.card.url).to.eq('https://cardstack.com/base/string');
    });

    it(`can invalidate a card via the update of a field of a field card`, async function () {
      outputJSONSync(join(getRealmDir(), 'address', 'card.json'), { schema: 'schema.js' });
      outputFileSync(join(getRealmDir(), 'address', 'schema.js'), ADDRESS_RAW_CARD.files['schema.js']);
      outputJSONSync(join(getRealmDir(), 'person', 'card.json'), { schema: 'schema.js' });
      outputFileSync(join(getRealmDir(), 'person', 'schema.js'), PERSON_RAW_CARD.files['schema.js']);
      outputJSONSync(join(getRealmDir(), 'post', 'card.json'), { schema: 'schema.js' });
      outputFileSync(
        join(getRealmDir(), 'post', 'schema.js'),
        `
        import { contains } from '@cardstack/types';
        import string from 'https://cardstack.com/base/string';
        import person from '${PERSON_RAW_CARD.realm}${PERSON_RAW_CARD.id}';
        export default class Post {
          @contains(string) title;
          @contains(person) author;
        }
      `
      );
      let si = await getContainer().lookup('searchIndex', { type: 'service' });
      await si.indexAllRealms();

      // add a "country" field to the address field card and observe that the post card includes the new address field via the author field
      await cards.update({
        realm: realmURL,
        id: 'address',
        schema: 'schema.js',
        files: {
          'schema.js': `
              import { contains } from "@cardstack/types";
              import string from "https://cardstack.com/base/string";
              import date from "https://cardstack.com/base/date";

              export default class Address {
                @contains(string) street;
                @contains(string) city;
                @contains(string) state;
                @contains(string) zip;
                @contains(date) settlementDate;
                @contains(string) country;
              }
            `,
        },
      });
      let post = await cards.load(`${realmURL}post`);
      expect(post.compiled.fields.author.card.fields.address.card.fields.country.card.url).to.eq(
        'https://cardstack.com/base/string'
      );
    });

    describe('computed field', function () {
      let greetingCard = {
        realm: realmURL,
        id: 'greeting-card',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            export default class GreetingCard {
              @contains(string) name;

              @contains(string)
              get greeting() {
                return "Welcome " + this.name + "!";
              }
            }
          `,
        },
      };

      this.beforeEach(async function () {
        await cards.create(greetingCard);

        // This child card gets created via adoptIntoRealm, which goes down the
        // code path that doesn't involve compiling cards
        let cardModel = await cards.loadModel(`${realmURL}greeting-card`, 'isolated');
        let sampleGreeting = cardModel.adoptIntoRealm(realmURL, 'sample-greeting');
        await sampleGreeting.setData({
          name: 'Jackie',
        });
        await sampleGreeting.save();

        // This child card gets created via cardService.create, which goes down
        // the code path that *does* involve compiling cards.
        await cards.create({
          realm: realmURL,
          id: 'different-greeting-card',
          adoptsFrom: '../sample-greeting',
          data: {
            name: 'Miles',
          },
        });
      });

      it('Can search for card computed field for card created with data', async function () {
        let results = await cards.query('isolated', {
          filter: {
            on: `${realmURL}greeting-card`,
            eq: {
              greeting: 'Welcome Jackie!',
            },
          },
        });

        expect(results.map((card) => card.url)).to.deep.equal([`${realmURL}sample-greeting`]);
      });

      it('Can search for card computed field for card after updating data', async function () {
        let cardModel = await cards.loadModel(`${realmURL}sample-greeting`, 'isolated');
        await cardModel.setData({
          name: 'Woody',
        });
        await cardModel.save();

        let results = await cards.query('isolated', {
          filter: {
            on: `${realmURL}greeting-card`,
            eq: {
              greeting: 'Welcome Woody!',
            },
          },
        });

        expect(results.map((card) => card.url)).to.deep.equal([`${realmURL}sample-greeting`]);
      });

      it('Can search for card computed field for card created with data and schema', async function () {
        let results = await cards.query('isolated', {
          filter: {
            on: `${realmURL}sample-greeting`,
            eq: {
              greeting: 'Welcome Miles!',
            },
          },
        });

        expect(results.map((card) => card.url)).to.deep.equal([`${realmURL}different-greeting-card`]);
      });

      it('Can search for card computed field for card after updating data and schema', async function () {
        await cards.update({
          realm: realmURL,
          id: 'greeting-card',
          schema: 'schema.js',
          files: {
            'schema.js': `
              import { contains } from "@cardstack/types";
              import string from "https://cardstack.com/base/string";
              export default class GreetingCard {
                @contains(string) name;
                @contains(string) breed;

                @contains(string)
                get greeting() {
                  return "Welcome " + this.name + " the " + this.breed + "!";
                }
              }
            `,
          },
          data: {
            name: 'J',
            breed: 'beagle',
          },
        });

        let results = await cards.query('isolated', {
          filter: {
            on: `${realmURL}greeting-card`,
            eq: {
              greeting: 'Welcome J the beagle!',
            },
          },
        });

        expect(results.map((card) => card.url)).to.deep.equal([`${realmURL}greeting-card`]);
      });

      it('can update computed fields in children when parent gets a schema change', async function () {
        await cards.update({
          realm: realmURL,
          id: 'greeting-card',
          schema: 'schema.js',
          files: {
            'schema.js': `
              import { contains } from "@cardstack/types";
              import string from "https://cardstack.com/base/string";
              export default class GreetingCard {
                @contains(string) name;
                @contains(string)
                get greeting() {
                  return "Goodbye " + this.name
                }
              }
            `,
          },
        });

        let results = await cards.query('isolated', {
          filter: {
            on: `${realmURL}greeting-card`,
            eq: {
              greeting: 'Goodbye Jackie',
            },
          },
        });

        expect(results.map((card) => card.url)).to.deep.equal([`${realmURL}sample-greeting`]);
      });
    });
  });
}
