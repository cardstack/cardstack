import { RawCard } from '@cardstack/core/src/interfaces';
import { ADDRESS_RAW_CARD, PERSON_RAW_CARD } from '@cardstack/core/tests/helpers';
import { expect } from 'chai';
import { outputJSONSync } from 'fs-extra';
import { join } from 'path';
import { configureHubWithCompiler } from '../helpers/cards';
import merge from 'lodash/merge';

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
      let si = await getContainer().lookup('searchIndex');
      await si.indexAllRealms();
      let post: RawCard = {
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
      };
      await cards.create(post);
      await cards.create({
        realm: realmURL,
        id: 'example',
        adoptsFrom: '../post',
      });

      // add an "author" field to the parent card and observe that the child card inherits this field
      post.files = {
        'schema.js': `
          import { contains } from '@cardstack/types';
          import string from 'https://cardstack.com/base/string';
          export default class Post {
            @contains(string) title;
            @contains(string) author;
          }
        `,
      };
      await cards.update(post);

      let example = await cards.load(`${realmURL}example`);
      expect(example.compiled.fields.author.card.url).to.eq('https://cardstack.com/base/string');
    });

    it(`can invalidate a card via the update of a field card`, async function () {
      let si = await getContainer().lookup('searchIndex');
      await si.indexAllRealms();
      await cards.create(ADDRESS_RAW_CARD);
      await cards.create(PERSON_RAW_CARD);

      // add a "country" field to the address field card and observe that the person card includes the new address field
      await cards.update(
        merge({}, ADDRESS_RAW_CARD, {
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
      let person = await cards.load(`${PERSON_RAW_CARD.realm}${PERSON_RAW_CARD.id}`);
      expect(person.compiled.fields.address.card.fields.country.card.url).to.eq('https://cardstack.com/base/string');
    });

    it(`can invalidate a card via the update of a grandparent adoptsFrom card`, async function () {
      let si = await getContainer().lookup('searchIndex');
      await si.indexAllRealms();
      let post: RawCard = {
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
      };
      await cards.create(post);
      await cards.create({
        realm: realmURL,
        id: 'example',
        adoptsFrom: '../post',
      });
      await cards.create({
        realm: realmURL,
        id: 'grandchild',
        adoptsFrom: '../example',
      });

      // add an "author" field to the parent card and observe that the grandchild card inherits this field
      post.files = {
        'schema.js': `
          import { contains } from '@cardstack/types';
          import string from 'https://cardstack.com/base/string';
          export default class Post {
            @contains(string) title;
            @contains(string) author;
          }
        `,
      };
      await cards.update(post);

      let grandchild = await cards.load(`${realmURL}grandchild`);
      expect(grandchild.compiled.fields.author.card.url).to.eq('https://cardstack.com/base/string');
    });

    it(`can invalidate a card via the update of a field of a field card`, async function () {
      let si = await getContainer().lookup('searchIndex');
      await si.indexAllRealms();
      await cards.create(ADDRESS_RAW_CARD);
      await cards.create(PERSON_RAW_CARD);
      await cards.create({
        realm: realmURL,
        id: 'post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from '@cardstack/types';
            import string from 'https://cardstack.com/base/string';
	          import person from "https://cardstack.local/person";
            export default class Post {
              @contains(string) title;
              @contains(person) author;
            }
          `,
        },
      });

      // add a "country" field to the address field card and observe that the post card includes the new address field via the author field
      await cards.update(
        merge({}, ADDRESS_RAW_CARD, {
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
