import { RawCard } from '@cardstack/core/src/interfaces';
import { ADDRESS_RAW_CARD, PERSON_RAW_CARD } from '@cardstack/core/tests/helpers';
import { expect } from 'chai';
import { outputFileSync, outputJSONSync } from 'fs-extra';
import { join } from 'path';
import { configureHubWithCompiler } from '../helpers/cards';
import merge from 'lodash/merge';

// So we are using a nonce here with the card fixtures to make sure that the
// file realm meta doesn't bite us. The file realm meta will only index cards
// newer than the last mtime, but that mtime has a resolution of a single
// second. for tests that run faster than that, it means the the indexing may
// skip a truly changed card because it is the same mtime as the file realm meta
// which was updated less than 1 second ago because tests run quickly.
let nonce = 100;
function getRawCards(): { personRawCard: RawCard; addressRawCard: RawCard } {
  let addressRawCard = Object.assign({}, ADDRESS_RAW_CARD, { id: `address-${nonce++}` });
  return {
    addressRawCard,
    personRawCard: merge(
      {},
      PERSON_RAW_CARD,
      { id: `person-${nonce++}` },
      {
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import date from "https://cardstack.com/base/date";
            import address from "${addressRawCard.realm}${addressRawCard.id}";

            export default class Person {
              @contains(string) name;
              @contains(date) birthdate;
              @contains(address) address;
            }
            `,
        },
      }
    ),
  };
}

if (process.env.COMPILER) {
  describe('SearchIndex', function () {
    let { getRealmDir, getContainer, realmURL, cards } = configureHubWithCompiler(this);

    it(`gives a good error at load time when a card can't compile`, async function () {
      outputJSONSync(join(getRealmDir(), 'example', 'card.json'), { adoptsFrom: '../post' });
      let si = await getContainer().lookup('searchIndex');
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
      let si = await getContainer().lookup('searchIndex');
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

      let example = await cards.load(`${realmURL}example`);
      expect(example.data?.title).to.eq('Hello World');
    });

    it(`can invalidate a card via creation of non-existent grandparent card`, async function () {
      outputJSONSync(join(getRealmDir(), 'example', 'card.json'), {
        adoptsFrom: '../post',
      });
      outputJSONSync(join(getRealmDir(), 'grandchild', 'card.json'), {
        adoptsFrom: '../example',
        data: { title: 'Hello World' },
      });
      let si = await getContainer().lookup('searchIndex');
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

      let grandChild = await cards.load(`${realmURL}grandchild`);
      expect(grandChild.data?.title).to.eq('Hello World');
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

      let si = await getContainer().lookup('searchIndex');
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

      let si = await getContainer().lookup('searchIndex');
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

      let si = await getContainer().lookup('searchIndex');
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
      let si = await getContainer().lookup('searchIndex');
      await si.indexAllRealms();
      let { addressRawCard, personRawCard } = getRawCards();
      await cards.create(addressRawCard);
      await cards.create(personRawCard);
      await cards.create({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from '@cardstack/types';
            import string from 'https://cardstack.com/base/string';
	          import person from "${personRawCard.realm}${personRawCard.id}";
            export default class Post {
              @contains(string) title;
              @contains(person) author;
            }
          `,
        },
      });

      // add a "country" field to the address field card and observe that the post card includes the new address field via the author field
      await cards.update(
        merge({}, addressRawCard, {
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
        })
      );
      let post = await cards.load(`${realmURL}post`);
      expect(post.compiled.fields.author.card.fields.address.card.fields.country.card.url).to.eq(
        'https://cardstack.com/base/string'
      );
    });
  });
}
