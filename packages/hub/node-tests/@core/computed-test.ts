import { expect } from 'chai';
import { configureHubWithCompiler } from '../helpers/cards';

if (process.env.COMPILER) {
  describe('computed', function () {
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
      expect(await card.getField('fullName')).to.equal('Arthur Faulkner');
    });

    it(`can access a two-level-deep computed field`, async function () {
      let card = await cards.loadData(`${realm}arthur`, 'isolated');
      expect(await card.getField('summary')).to.equal('Arthur Faulkner is a person');
    });

    it(`can throw exception it has arguments`, async function () {
      try {
        await cards.create({
          realm,
          id: 'person',
          schema: 'schema.js',
          files: {
            'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Guest {
              @contains(string) firstName;
              @contains(string) lastName;

              @contains(string)
              async fullName(arg) {
                return (await this.firstName()) + " " + (await this.lastName());
              }
            }
          `,
          },
        });
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.include(`computed fields take no arguments`);
      }
    });

    it(`can throw exception if it has static name`, async function () {
      try {
        await cards.create({
          realm,
          id: 'person',
          schema: 'schema.js',
          files: {
            'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            export default class Guest {
              @contains(string) firstName;
              @contains(string) lastName;

              @contains(string)
              static async fullName() {
                return (await this.firstName()) + " " + (await this.lastName());
              }
            }
          `,
          },
        });
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.include(`computed fields should not be static`);
      }
    });
  });
}
