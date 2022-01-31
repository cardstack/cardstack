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

    it.skip('can access a composite field', async function () {
      let card = await cards.loadData(`${realm}arthur`, 'isolated');

      // what actually is returned here? since it's a contained card it probably
      // is not a CardModel--maybe it's a POJO of all the usedFields that are in
      // the contained card? since aboutMe.short is a used field does that imply
      // that aboutMe is a used field?
      expect(await card.getField('aboutMe')).to.deep.equal({ short: 'son of Ed' });
    });

    // we can use the field meta short cut here to just return raw data without
    // having to load the schema module
    it('can access a primitive field');
    it('can access a field that requires deserialization');
    it('can have a field that is the same card as itself');
  });
}
