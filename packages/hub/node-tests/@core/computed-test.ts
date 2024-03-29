import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers';
import { expect } from 'chai';
import { configureHubWithCompiler } from '../helpers/cards';
import { parse, isSameDay } from 'date-fns';

function p(dateString: string): Date {
  return parse(dateString, 'yyyy-MM-dd', new Date());
}

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
              @contains(bio) aboutMe;

              @contains(string)
              get fullName() {
                return this.firstName + " " + this.lastName;
              }

              @contains(string)
              get summary() {
                return this.fullName + " is a person. Their story is: " + this.aboutMe.short;
              }

              @contains(string, { computeVia: "computeSlowSummary" }) slowSummary;
              async computeSlowSummary() {
                await new Promise(resolve => setTimeout(resolve, 10));
                return this.summary;
              }

              @contains(string)
              get loudSummary() {
                return this.slowSummary + "!";
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

    it(`can access a synchronous computed field`, async function () {
      let card = await cards.loadModel(`${realm}arthur`, 'isolated');
      expect(await card.getField('fullName')).to.equal('Arthur Faulkner');
    });

    it(`can access a two-level-deep synchronous computed field`, async function () {
      let card = await cards.loadModel(`${realm}arthur`, 'isolated');
      expect(await card.getField('summary')).to.equal('Arthur Faulkner is a person. Their story is: son of Ed');
    });

    it('can access a composite field', async function () {
      let card = await cards.loadModel(`${realm}arthur`, 'isolated');
      let aboutMe = await card.getField('aboutMe');
      expect(aboutMe.short).to.equal('son of Ed');
      expect(aboutMe.favoriteColor).to.equal('blue');
    });

    it('can access an asynchronous computed field', async function () {
      let card = await cards.loadModel(`${realm}arthur`, 'isolated');
      expect(await card.getField('slowSummary')).to.equal('Arthur Faulkner is a person. Their story is: son of Ed');
    });

    it('can indirectly access an asynchronous computed field', async function () {
      let card = await cards.loadModel(`${realm}arthur`, 'isolated');
      expect(await card.getField('loudSummary')).to.equal('Arthur Faulkner is a person. Their story is: son of Ed!');
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
      let card = await cards.loadModel(`${realm}ains`, 'isolated');
      expect(await card.getField('fullName')).to.equal('Ains Ooal Gown');
      expect(await card.getField('seriesName')).to.equal('Overlord');
    });

    it('can access an asynchronous computed field defined in parent card', async function () {
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
      let card = await cards.loadModel(`${realm}ains`, 'isolated');
      expect(await card.getField('fullName')).to.equal('Ains Ooal Gown');
      expect(await card.getField('loudSummary')).to.equal(
        'Ains Ooal Gown is a person. Their story is: Supreme overlord of darkness!'
      );
    });

    it('can access a field that requires deserialization', async function () {
      await cards.create({
        realm,
        id: 'test',
        schema: 'schema.js',
        data: {
          date: '2022-03-24',
        },
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import date from "https://cardstack.com/base/date";
            export default class Test {
              @contains(date) date;
              @contains(date) 
              get nextDay() {
                return new Date(this.date.getTime() + (24 * 60 * 60 * 1000));
              }
            }
          `,
        },
      });

      let card = await cards.loadModel(`${realm}test`, 'isolated');
      expect(isSameDay(await card.getField('nextDay'), p('2022-03-25')), 'Dates are serialized to Dates').to.be.ok;
      expect(isSameDay(card.data['nextDay'], p('2022-03-25')), 'Dates are serialized to Dates').to.be.ok;
      expect(card.serialize().attributes?.nextDay).to.equal('2022-03-25');
    });
  });
}
