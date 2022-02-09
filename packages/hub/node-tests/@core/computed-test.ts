import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers';
import { expect } from 'chai';
import { configureHubWithCompiler } from '../helpers/cards';

if (process.env.COMPILER) {
  describe('computed', function () {
    let { realmURL: realm, cards } = configureHubWithCompiler(this);

    this.beforeEach(async function () {
      await cards.create({
        realm,
        id: 'bio',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            export default class Bio {
              getRawField = "don't collide!";
              @contains(string) short;
              @contains(string) favoriteColor;
            }
          `,
        },
      });
      await cards.create({
        realm,
        id: 'person',
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import bio from "../bio";
            export default class Person {
              @contains(string) firstName;
              @contains(string) lastName;

              // TODO:
              // @contains(Person) parent;

              @contains(bio) aboutMe;

              @contains(string)
              async fullName() {
                return (await this.firstName) + " " + (await this.lastName);
              }

              @contains(string)
              async summary() {
                return (await this.fullName) + " is a person. Their story is: " + (await this.aboutMe.short);
              }
            }
          `,
          // firstName, lastName, summary, and bio.short should be considered as used
          // fields since summary depends on all of them, right?
          'isolated.js': templateOnlyComponentTemplate(`<div><@fields.summary/></div>`),
        },
      });

      await cards.create({
        realm,
        id: 'arthur',
        adoptsFrom: '../person',
        data: {
          firstName: 'Arthur',
          lastName: 'Faulkner',
          aboutMe: {
            short: 'son of Ed',
            favoriteColor: 'blue',
          },
        },
      });
    });

    it(`can access a one-level-deep computed field`, async function () {
      let card = await cards.loadData(`${realm}arthur`, 'isolated');
      expect(await card.getField('fullName')).to.equal('Arthur Faulkner');
    });

    it(`can access a two-level-deep computed field`, async function () {
      let card = await cards.loadData(`${realm}arthur`, 'isolated');
      expect(await card.getField('summary')).to.equal('Arthur Faulkner is a person. Their story is: son of Ed');
    });

    it('can access a composite field', async function () {
      let card = await cards.loadData(`${realm}arthur`, 'isolated');
      expect(await card.getField('aboutMe')).to.deep.equal({
        short: 'son of Ed',
        // note that this loads all the fields of aboutMe, including ones that
        // are not used by the Person template
        favoriteColor: 'blue',
      });
    });

    it('can access a computed field defined in parent card', async function () {
      await cards.create({
        realm,
        id: 'ains',
        adoptsFrom: '../person',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { adopts, contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import person from "../person";
            export default @adopts(person) class Isekai {
              @contains(string) seriesName;
            }
          `,
        },
        data: {
          firstName: 'Ains Ooal',
          lastName: 'Gown',
          seriesName: 'Overload',
          aboutMe: {
            short: 'Supreme overload of darkness',
            favoriteColor: 'black',
          },
        },
      });
      let card = await cards.loadData(`${realm}ains`, 'isolated');
      expect(await card.getField('fullName')).to.equal('Ains Ooal Gown');
    });

    // we can use the field meta short cut here to just return raw data without
    // having to load the schema module
    it('can access a primitive field');
    it('can access a field that requires deserialization');
    it('can have a field that is the same card as itself');
  });
}
