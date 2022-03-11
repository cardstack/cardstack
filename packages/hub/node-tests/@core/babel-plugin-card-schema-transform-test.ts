import { TEST_REALM as realm } from '@cardstack/core/tests/helpers/fixtures';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { configureHubWithCompiler } from '../helpers/cards';
import { RawCard } from '@cardstack/core/src/interfaces';
import { cardURL } from '@cardstack/core/src/utils';

if (process.env.COMPILER) {
  describe('babel-plugin-card-schema-transform', function () {
    let { cards, getFileCache } = configureHubWithCompiler(this);
    let fancyDateCard: RawCard = {
      realm,
      id: 'fancy-date',
      adoptsFrom: 'https://cardstack.com/base/date',
    };
    let bioCard: RawCard = {
      realm,
      id: 'bio',
      schema: 'schema.js',
      files: {
        'schema.js': `
            import { contains } from "@cardstack/types";
            import date from "https://cardstack.com/base/date";

            export default class Bio {
              getRawField = "don't collide!";
              @contains(date) birthdate;
            }
          `,
      },
    };
    let personCard: RawCard = {
      realm,
      id: 'person',
      schema: 'schema.js',
      isolated: 'isolated.js',
      embedded: 'embedded.js',
      edit: 'edit.js',
      files: {
        'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import bio from "../bio";
            export default class Person {
              @contains(string) lastName;
              @contains(bio) aboutMe;

              @contains(string)
              get fullName() {
                return "Mr or Mrs " + this.lastName;
              }

              @contains(string, { computeVia: "computeSlowName" }) slowName;
              async slowName() {
                await new Promise(resolve => setTimeout(resolve, 10));
                return this.fullName;
              }

              _cachedSlowName = "don't collide!";
              data = "don't collide!";
            }
          `,
        'edit.js': templateOnlyComponentTemplate(`<div><@fields.lastName/><@fields.aboutMe/></div>`),
        'isolated.js': templateOnlyComponentTemplate(
          `<div><@fields.fullName/><@fields.aboutMe.birthdate/><@fields.slowName/></div>`
        ),
        'embedded.js': templateOnlyComponentTemplate(`<div><@fields.fullName/></div>`),
      },
    };
    let fancyPersonCard: RawCard = {
      realm,
      id: 'fancy-person',
      schema: 'schema.js',
      files: {
        'schema.js': `
            import { adopts } from "@cardstack/types";
            import person from "../person";
            export default @adopts(person) class FancyPerson {

            }
          `,
      },
    };
    let reallyFancyPersonCard: RawCard = {
      realm,
      id: 'really-fancy-person',
      schema: 'schema.js',
      files: {
        'schema.js': `
            import { adopts, contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import fancyPerson from "../fancy-person";
            export default @adopts(fancyPerson) class ReallyFancyPerson {
              @contains(string) middleName;
            }
          `,
      },
    };

    this.beforeEach(async function () {
      await cards.create(fancyDateCard);
      await cards.create(bioCard);
      await cards.create(personCard);
      await cards.create(fancyPersonCard);
      await cards.create(reallyFancyPersonCard);
    });

    it('can handle unconsumed field import', async function () {
      await cards.create({
        realm,
        id: 'foo',
        schema: 'schema.js',
        files: {
          'schema.js': `
              import { contains } from "@cardstack/types";
              import string from "https://cardstack.com/base/string";

              export default class Foo {
                @contains(string) bar;
              }
            `,
        },
      });

      let card = await cards.create({
        realm,
        id: 'test',
        schema: 'schema.js',
        files: {
          'schema.js': `
              import { contains } from "@cardstack/types";
              import string from "https://cardstack.com/base/string";
              import date from "https://cardstack.com/base/date";
              import Foo from "../foo";

              export default class Test {
                @contains(string) name;
              }
            `,
        },
      });

      // success is really just not throwing an exception
      expect(card.compiled.url).to.eq(`${realm}test`);
    });

    it('can compile used fields into schema module', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        export const usedFields = {
          edit: ["lastName", "aboutMe.birthdate"],
          isolated: ["fullName", "aboutMe.birthdate", "slowName"],
          embedded: ["fullName"]
        }
      `);
    });

    it('can compile all fields into schema module', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        export const allFields = ["lastName", "aboutMe.birthdate", "fullName", "slowName"];
      `);
    });

    it('can compile a data method into the schema class', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        import set from "lodash/set";
        import get from "lodash/get";
      `);
      expect(source).to.containsSource(`
        export const dataMember = "data0";
      `);
      expect(source).to.containsSource(`
        data0(format) {
          let data = {};
          let fields = format === 'all' ? allFields : usedFields[format] ?? [];
          for (let field of fields) {
            let value = get(this, field);
            if (value !== undefined) {
              set(data, field, value);
            }
          }
          return data;
        }
      `);
    });

    it('can compile schema class constructor for composite card', async function () {
      let { compiled } = await cards.load(`${realm}bio`);
      // the browser source has a lot less babel shenanigans
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
          getRawField0;

          constructor(get) {
            this.getRawField0 = get;
          }
        `);
    });

    it('can compile primitive field implementation in schema.js module', async function () {
      let { compiled } = await cards.load(`${realm}bio`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.not.containsSource(`@contains`);
      expect(source).to.not.containsSource(`https://cardstack.com/base/string`);
      expect(source).to.containsSource(`
          get birthdate() {
            return this.getRawField0("birthdate");
          }
        `);
    });

    it('can compile composite field implementation in schema.js module', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.not.containsSource(`@contains`);
      expect(source).to.not.containsSource(`${realm}bio`);
      expect(source).to.containsSource(`
          import BioClass from "@cardstack/compiled/https-cardstack.local-bio/schema.js";
        `);
      expect(source).to.containsSource(`
          get aboutMe() {
            return new BioClass(innerField => this.getRawField("aboutMe." + innerField));
          }
        `);
    });

    it('can compile synchronous computed field in schema.js module', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.not.containsSource(`@contains`);
      expect(source).to.containsSource(`
          get fullName() {
            return "Mr or Mrs " + this.lastName;
          }
        `);
    });

    it('can compile async computed field in schema.js module', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.not.containsSource(`@contains`);
      expect(source).to.containsSource(`
          import { NotReady } from "@cardstack/core/src/utils/errors";
        `);
      expect(source).to.containsSource(`
          _cachedSlowName0;

          get slowName() {
            if (this._cachedSlowName0 !== undefined) {
              return this._cachedSlowName0;
            } else {
              throw new NotReady(this, "slowName", "computeSlowName", "_cachedSlowName0", "Person");
            }
          }
        `);
    });

    it('can compile a schema.js that adopts from a composite card has no additional fields', async function () {
      let { compiled } = await cards.load(`${realm}fancy-person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        import PersonClass from "@cardstack/compiled/https-cardstack.local-person/schema.js";
      `);
      expect(source).to.containsSource(`
        export default class FancyPerson extends PersonClass {
      `);
      expect(source).to.not.containsSource(`
        getRawField;
      `);
      expect(source).to.not.containsSource(`
        constructor(
      `);
    });

    it('can make a constructor for a schema.js that adopts from a composite card has additional fields', async function () {
      let { compiled } = await cards.load(`${realm}really-fancy-person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
          getRawField;

          constructor(get) {
            super(get);
            this.getRawField = get;
          }
        `);
    });

    it(`doesn't allow a card that adopts from a primitive card to become a composite card by having fields`, async function () {
      let parentURL = cardURL(fancyDateCard);
      let badCard = {
        realm,
        id: 'bad-date',
        schema: 'schema.js',
        files: {
          'schema.js': `
              import { adopts, contains } from "@cardstack/types";
              import fancyDate from "${parentURL}";
              import string from "https://cardstack.com/base/string";
              export default @adopts(fancyDate) class BadDate {
                @contains(string) constellation;
              }`,
        },
      };

      try {
        await cards.create(badCard);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.equal(
          `Card ${cardURL(
            badCard
          )} adopting from primitive parent ${parentURL} must be of primitive type itself and should not have a schema.js file.`
        );
      }
    });
  });
}
