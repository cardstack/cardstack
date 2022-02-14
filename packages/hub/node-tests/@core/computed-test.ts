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
              getRawField = "don't collide!";
              @contains(string) firstName;
              @contains(string) lastName;

              // TODO:
              // @contains(Person) parent;

              @contains(bio) aboutMe;

              @contains(string)
              get fullName() {
                return this.firstName + " " + this.lastName;
              }

              @contains(string)
              get summary() {
                return this.fullName + " is a person. Their story is: " + this.aboutMe.short;
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

    it('can access a synchronous composite field', async function () {
      let card = await cards.loadData(`${realm}arthur`, 'isolated');
      let aboutMe = await card.getField('aboutMe');
      expect(aboutMe.short).to.equal('son of Ed');
      expect(aboutMe.favoriteColor).to.equal('blue');
    });

    it('can access a synchronous computed field defined in parent card', async function () {
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
          seriesName: 'Overlord',
          aboutMe: {
            short: 'Supreme overlord of darkness',
            favoriteColor: 'black',
          },
        },
      });
      let card = await cards.loadData(`${realm}ains`, 'isolated');
      expect(await card.getField('fullName')).to.equal('Ains Ooal Gown');
      expect(await card.getField('seriesName')).to.equal('Overlord');
    });

    it('can access an asynchronous field via a contained card');
    it('can access an asynchronous computed field');
    it('can access an asynchronous computed field defined in parent card');

    it('can access a field that requires deserialization');
    it('can have a field that is the same card as itself');
  });
}
