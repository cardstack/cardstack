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
                  return (await this.fullName) + " is a person. Their story is: " + await this.bio.short;
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
          bio: {
            short: 'son of Ed',
          },
        },
      });
    });

    it.only(`can access a one-level-deep computed field`, async function () {
      let card = await cards.loadData(`${realm}arthur`, 'isolated');
      expect(await card.getField('fullName')).to.equal('Arthur Faulkner');
    });

    it(`can access a two-level-deep computed field`, async function () {
      let card = await cards.loadData(`${realm}arthur`, 'isolated');
      expect(await card.getField('summary')).to.equal('Arthur Faulkner is a person. Their story is: son of Ed');
    });
  });
}
