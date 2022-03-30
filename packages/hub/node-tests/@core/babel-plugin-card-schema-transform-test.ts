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
            import string from "https://cardstack.com/base/string";

            export default class Bio {
              getRawField = "don't collide!";
              @contains(date) birthdate;
              @contains(string) background;
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

    it('can handle unconsumed field import for different types of import specifiers', async function () {
      await cards.create({
        realm,
        id: 'bar',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            export default class Bar {
              @contains(string) bar;
            }

            let foo = 'foo';
            let bar1 = 'bar-1';
            let bar3 = 'bar-3';
            export { foo, bar1, bar3 };

            export let bar2 = 'bar-2';
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
            import _, { _camelCase } from "lodash";
            import * as randomImport from "i-dont-exist";
            import badImport, { incorrectUnusedImport } from "i-dont-exist";
            import * as foo from "../bar";
            import { bar3 } from "../bar";
            import bar2, { bar1, foo as foo1 } from "../bar";

            export default class Test {
              @contains(string) name;
            }
          `,
        },
      });
      expect(card.compiled.url).to.eq(`${realm}test`);

      let { compiled } = await cards.load(`${realm}test`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(
        `import string from "@cardstack/compiled/https-cardstack.com-base-string/schema.js";`
      );
      expect(source).not.to.containsSource(`import _, { _camelCase } from "lodash";`);
      expect(source).not.to.match(/import .*? from "i-dont-exist";/gm);
      expect(source).not.to.match(/import .*? from "\.\.\/bar";/gm);
      expect(source).not.to.match(/foo\d?|bar\d?|randomImport|badImport|incorrectUnusedImport/gm);
    });

    it('can compile used fields into schema module', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        const usedFields = {
          isolated: ["fullName", "aboutMe.birthdate", "slowName"],
          embedded: ["fullName"],
          edit: ["lastName", "aboutMe.birthdate", "aboutMe.background"]
        }
      `);
    });

    it('can compile all fields into schema module', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        const allFields = ["lastName", "aboutMe.birthdate", "aboutMe.background", "fullName", "slowName"];
      `);
    });

    it('can compile writable fields into schema module', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        const writableFields = ["lastName", "aboutMe"];
      `);
    });

    it(`can include imports from @cardstack/core/src/utils/fields`, async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        import { flattenData, getFieldsAtPath, getSerializedProperties } from "@cardstack/core/src/utils/fields";
      `);
    });

    it('can compile a serialize method into the schema class', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        static serialize(instance, fieldsOrFormat) {
          let fields;
          if (typeof fieldsOrFormat === 'string') {
            fields = fieldsOrFormat === 'all' ? allFields : usedFields[fieldsOrFormat] ?? [];
          } else if (Array.isArray(fieldsOrFormat)) {
            fields = [...fieldsOrFormat];
          } else {
            throw new Error('fieldsOrFormat must be a string or an array');
          }
          return getSerializedProperties(instance, fields);
        }
      `);
    });

    it('can compile a serializedGet', async function () {
      let { compiled } = await cards.load(`${realm}bio`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        import * as DateSerializer from "@cardstack/compiled/https-cardstack.com-base-date/serializer.js";
      `);
      expect(source).to.containsSource(`
        static serializedGet(instance, field) {
          if (instance.serializedData.has(field)) {
            return instance.serializedData.get(field);
          }

          let value = instance[field];

          if (field === "birthdate" && value !== null) {
            value = DateSerializer.serialize(value);
          }

          ;
          instance.serializedData.set(field, value);
          return value;
        }
      `);
    });

    it('can compile a serializedSet', async function () {
      let { compiled } = await cards.load(`${realm}bio`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        static serializedSet(instance, field, value) {
          instance.data.delete(field);
          instance.serializedData.set(field, value);
        }
      `);
    });

    it('can compile a serializedGet for a schema that has composite fields', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        import BioClass from "@cardstack/compiled/https-cardstack.local-bio/schema.js";
      `);
      expect(source).to.containsSource(`
        static serializedGet(instance, field) {
          if (instance.serializedData.has(field)) {
            return instance.serializedData.get(field);
          }

          let value = instance[field];
          ;

          if (field === "aboutMe" && value !== null) {
            let fields = getFieldsAtPath(field, instance.loadedFields);
            value = BioClass.serialize(value, fields);
          }

          instance.serializedData.set(field, value);
          return value;
        }
      `);
    });

    it('can compile a hasField method into the schema class', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        static hasField(field) {
          return allFields.includes(field);
        }
      `);
    });

    it('can compile a loadedFields method into the schema class', async function () {
      let { compiled } = await cards.load(`${realm}person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        static loadedFields(schemaInstance) {
          return [...schemaInstance.loadedFields];
        }
      `);
    });

    it('can compile schema class constructor for composite card', async function () {
      let { compiled } = await cards.load(`${realm}bio`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        data = new Map();
        serializedData = new Map();
        loadedFields = [];
        isComplete;

        constructor(rawData, makeComplete, isDeserialized = false) {
          this.isComplete = makeComplete;
          if (!rawData) {
            return;
          }
          this.loadedFields = makeComplete ? allFields : flattenData(rawData).map(([fieldName]) => fieldName);
          for (let [field, value] of Object.entries(rawData)) {
            if (!writableFields.includes(field)) {
              continue;
            }
            if (isDeserialized) {
              this[field] = value;
            } else {
              Bio.serializedSet(this, field, value);
            }
          }
        }
      `);
    });

    it('can compile primitive field implementation in schema.js module', async function () {
      let { compiled } = await cards.load(`${realm}bio`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.not.containsSource(`@contains`);
      expect(source).to.not.containsSource(`https://cardstack.com/base/string`);
      expect(source).to.containsSource(`
        get background() {
          if (this.data.has("background")) {
            return this.data.get("background");
          }

          if (this.serializedData.has("background")) {
            return this.serializedData.get("background");
          }

          if (!this.isComplete) {
            throw new Error("TODO: background");
          }

          return null;
        }

        set background(value) {
          this.serializedData.delete("background");
          this.data.set("background", value);
        }
      `);
    });

    it('can compile primitive field with custom serializer in schema.js module', async function () {
      let { compiled } = await cards.load(`${realm}bio`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.not.containsSource(`@contains`);
      expect(source).to.not.containsSource(`https://cardstack.com/base/string`);
      expect(source).to.containsSource(`
        import * as DateSerializer from "@cardstack/compiled/https-cardstack.com-base-date/serializer.js";
      `);
      expect(source).to.containsSource(`
        get birthdate() {
          if (this.data.has("birthdate")) {
            return this.data.get("birthdate");
          }

          if (this.serializedData.has("birthdate")) {
            let value = this.serializedData.get("birthdate");
            if (value !== null) {
              value = DateSerializer.deserialize(value);
            }
            this.data.set("birthdate", value);
            return value;
          }

          if (!this.isComplete) {
            throw new Error("TODO: birthdate");
          }

          return null;
        }

        set birthdate(value) {
          this.serializedData.delete("birthdate");
          this.data.set("birthdate", value);
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
          if (this.data.has("aboutMe")) {
            return this.data.get("aboutMe");
          }

          if (this.serializedData.has("aboutMe") || this.isComplete) {
            let fields = getFieldsAtPath("aboutMe", this.loadedFields);
            let value = this.serializedData.get("aboutMe") || {};
            value = new BioClass(value, this.isComplete);
            this.data.set("aboutMe", value);
            return value;
          }

          if (!this.isComplete) {
            throw new Error("TODO: aboutMe");
          }

          return null;
        }

        set aboutMe(value) {
          this.serializedData.delete("aboutMe");
          let fields = getFieldsAtPath("aboutMe", this.loadedFields);
          this.data.set("aboutMe", new BioClass(value, this.isComplete, true));
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
        data = {};
        isDeserialized = {};
      `);
      expect(source).to.containsSource(`
        data = new Map();
        serializedData = new Map();
        loadedFields = [];
        isComplete;

        constructor(rawData, makeComplete, isDeserialized = false) {
          super(rawData, makeComplete, isDeserialized);
          this.isComplete = makeComplete;
          if (!rawData) {
            return;
          }
          this.loadedFields = makeComplete ? allFields : flattenData(rawData).map(([fieldName]) => fieldName);
          for (let [field, value] of Object.entries(rawData)) {
            if (!writableFields.includes(field)) {
              continue;
            }
            if (isDeserialized) {
              this[field] = value;
            } else {
              FancyPerson.serializedSet(this, field, value);
            }
          }
        }
      `);
    });

    it('can make a constructor for a schema.js that adopts from a composite card has additional fields', async function () {
      let { compiled } = await cards.load(`${realm}really-fancy-person`);
      let source = getFileCache().getModule(compiled.schemaModule.global, 'browser');
      expect(source).to.containsSource(`
        data = new Map();
        serializedData = new Map();
        loadedFields = [];
        isComplete;

        constructor(rawData, makeComplete, isDeserialized = false) {
          super(rawData, makeComplete, isDeserialized);
          this.isComplete = makeComplete;
          if (!rawData) {
            return;
          }
          this.loadedFields = makeComplete ? allFields : flattenData(rawData).map(([fieldName]) => fieldName);
          for (let [field, value] of Object.entries(rawData)) {
            if (!writableFields.includes(field)) {
              continue;
            }
            if (isDeserialized) {
              this[field] = value;
            } else {
              ReallyFancyPerson.serializedSet(this, field, value);
            }
          }
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
