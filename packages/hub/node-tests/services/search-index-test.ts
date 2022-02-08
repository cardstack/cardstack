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

      let example = await cards.loadData(`${realmURL}example`, 'isolated');
      expect(example.data.title).to.eq('Hello World');
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

      let grandChild = await cards.loadData(`${realmURL}grandchild`, 'isolated');
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
              async greeting() {
                return "Welcome " + await this.name;
              }
            }
          `,
        },
      };

      let sampleGreeting = {
        realm: realmURL,
        id: 'sample-greeting',
        adoptsFrom: '../greeting-card',
        data: {
          name: 'Jackie',
        },
      };

      let differentGreetingCard = {
        realm: realmURL,
        id: 'different-greeting-card',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class DifferentGreetingCard {
              @contains(string) name;

              @contains(string)
              async greeting() {
                return "Welcome " + await this.name;
              }
            }
          `,
        },
        data: {
          name: 'Woody',
        },
      };

      // let customGreeting = {
      //   realm: realmURL,
      //   id: 'custom-greeting',
      //   schema: 'schema.js',
      //   files: {
      //     'schema.js': `
      //       import { contains, adopts } from "@cardstack/types";
      //       import greetingCard from "../greeting-card";
      //       import string from "https://cardstack.com/base/string";
      //       export default @adopts(greetingCard) class CustomGreetingCard {
      //         @contains(string) role;

      //         @contains(string)
      //         async desc() {
      //           return "Greeting for " + await this.role;
      //         }
      //       }
      //     `,
      //   },
      //   data: {
      //     name: 'Jackie',
      //     role: 'good dog',
      //   },
      // };

      this.beforeEach(async function () {
        let si = await getContainer().lookup('searchIndex', { type: 'service' });
        await si.indexAllRealms();

        await cards.create(greetingCard);
        await cards.create(sampleGreeting);
        await cards.create(differentGreetingCard);
        // await cards.create(customGreeting);
      });

      it.only('Can search for card computed field for card created with data', async function () {
        let baseCard = await cards.loadData(`${realmURL}greeting-card`, 'isolated');
        expect(baseCard.data.name).to.not.exist;
        expect(baseCard.data.greeting).to.not.exist;

        let card = await cards.loadData(`${realmURL}sample-greeting`, 'isolated');
        expect(card.data.name).to.eq('Jackie');
        expect(card.data.greeting).to.eq('Welcome Jackie');
      });

      it.only('Can search for card computed field for card created with data and schema', async function () {
        let card = await cards.loadData(`${realmURL}different-greeting-card`, 'isolated');
        expect(card.data.name).to.eq('Woody');
        expect(card.data.greeting).to.eq('Welcome Woody');
      });

      it.skip('Can search for card computed field for card created with data and schema that adopts from another card', async function () {
        let card = await cards.loadData(`${realmURL}custom-greeting`, 'isolated');
        expect(card.data.name).to.eq('Jackie');
        expect(card.data.greeting).to.eq('Welcome Jackie');
        expect(card.data.role).to.eq('good dog');
        expect(card.data.desc).to.eq('Greeting for good dog');
      });

      it.only('Can search for card computed field for card after updating data', async function () {
        await cards.update({
          realm: realmURL,
          id: 'sample-greeting',
          adoptsFrom: '../greeting-card',
          data: {
            name: 'Woody',
          },
        });

        let card = await cards.loadData(`${realmURL}sample-greeting`, 'isolated');
        expect(card.data.name).to.eq('Woody');
        expect(card.data.greeting).to.eq('Welcome Woody');
      });

      it.only('Can search for card computed field for card after updating data and schema', async function () {
        await cards.update({
          realm: realmURL,
          id: 'different-greeting-card',
          schema: 'schema.js',
          files: {
            'schema.js': `
              import { contains } from "@cardstack/types";
              import string from "https://cardstack.com/base/string";
              export default class DifferentGreetingCard {
                @contains(string) name;
                @contains(string) breed;

                @contains(string)
                async greeting() {
                  return "Hello " + await this.name + " the " + await this.breed;
                }
              }
            `,
          },
          data: {
            name: 'Jackie',
            breed: 'beagle',
          },
        });

        let card = await cards.loadData(`${realmURL}different-greeting-card`, 'isolated');
        expect(card.data.name).to.eq('Jackie');
        expect(card.data.greeting).to.eq('Hello Jackie the beagle');
      });
    });
  });
}
