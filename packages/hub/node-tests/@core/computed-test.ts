import { expect } from 'chai';
import { configureHubWithCompiler } from '../helpers/cards';

if (process.env.COMPILER) {
  describe.skip('computed', function () {
    let { realmURL: realm, cards } = configureHubWithCompiler(this);

    this.beforeEach(async function () {
      await cards.create({
        realm,
        id: 'person',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Person {
              @contains(string) firstName;
              @contains(string) lastName;

              @contains(string)
              async fullName() {
                return (await this.firstName()) + " " + (await this.lastName());
              }

              @contains(string)
              async summary() {
                  return (await this.fullName()) + " is a person";
              }
            }
          `,
        },
      });

      await cards.create({
        realm,
        id: 'arthur',
        adoptsFrom: '../person',
        data: {
          firstName: 'Arthur',
          lastName: 'Faulkner',
        },
      });
    });

    it(`can access a one-level-deep computed field`, async function () {
      let card = await cards.loadData(`${realm}arthur`, 'isolated');
      expect(card.data.fullName).to.equal('Arthur Faulkner');
    });
  });
}
