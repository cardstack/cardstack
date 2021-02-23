import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { Compiler } from '@cardstack/core';
import { compilerTestSetup, addRawCard } from '@cardstack/core/tests/helpers';

module('Integration | compiler-adoption', function (hooks) {
  setupRenderingTest(hooks);
  compilerTestSetup(hooks);

  let compiler = new Compiler();

  hooks.beforeEach(async function () {
    await addRawCard({
      url: 'https://localhost/base/models/person',
      'schema.js': `
        import { contains } from "@cardstack/types";
        import date from "https://cardstack.com/base/models/date";
        import string from "https://cardstack.com/base/models/string";
        export default class Person {
          @contains(string)
          name;

          @contains(date)
          birthdate;
        }
      `,
      'embedded.hbs': `<this.name/> was born on <this.birthdate/>`,
    });
  });

  module('fields', async function (/*hooks*/) {
    test('a blank card can adopt fields from a card', async function (assert) {
      let card = {
        'schema.js': `
          import { adopts } from "@cardstack/types";
          import Person from "https://localhost/base/models/person";

          export default @adopts(Person) class User {}
      `,
      };
      let compiled = await compiler.compile(card);
      assert.deepEqual(Object.keys(compiled.fields), ['name', 'birthdate']);
    });

    test('A child card can add a field', async function (assert) {
      let card = {
        'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import Person from "https://localhost/base/models/person";
          import string from "https://cardstack.com/base/models/string";

          export default @adopts(Person) class User {
            @contains(string)
            username
          }
      `,
      };
      let compiled = await compiler.compile(card);
      assert.deepEqual(Object.keys(compiled.fields), [
        'username',
        'name',
        'birthdate',
      ]);
    });

    test('A child card can NOT overwrite an existing field', async function (assert) {
      let card = {
        'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import Person from "https://localhost/base/models/person";
          import string from "https://cardstack.com/base/models/string";

          export default @adopts(Person) class User {
            @contains(string)
            birthdate
          }
      `,
      };

      assert.expect(1);
      try {
        await compiler.compile(card);
      } catch (err) {
        assert.equal(
          'Field collision on birthdate with parent card https://localhost/base/models/person',
          err.message
        );
      }
    });

    test('A child card can NOT overwrite an existing field, even from a grandparent', async function (assert) {
      await addRawCard({
        url: 'https://localhost/base/models/user',
        'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import Person from "https://localhost/base/models/person";
          import string from "https://cardstack.com/base/models/string";

          export default @adopts(Person) class User {
            @contains(string)
            username
          }`,
      });

      let card = {
        'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import User from "https://localhost/base/models/user";
          import string from "https://cardstack.com/base/models/string";

          export default @adopts(User) class Admin {
            @contains(string)
            name
          }
      `,
      };

      assert.expect(1);
      try {
        await compiler.compile(card);
      } catch (err) {
        assert.equal(
          'Field collision on name with parent card https://localhost/base/models/user',
          err.message
        );
      }
    });
  });

  module('templates', async function (/*hooks*/) {
    test('a child card inherits a parent card template', async function (assert) {
      let card = {
        'schema.js': `
            import { adopts } from "@cardstack/types";
            import Person from "https://localhost/base/models/person";

            export default @adopts(Person) class User {}
        `,
      };
      let compiled = await compiler.compile(card);
      assert.equal(
        compiled.templateSources.embedded,
        `{{this.name}} was born on <FormatDate @date={{this.birthdate}} />`
      );
    });

    test('a child card inherits a grandparent card template, when it and parent do not have templates', async function (assert) {
      await addRawCard({
        url: 'https://localhost/base/models/user',
        'schema.js': `
          import { adopts, contains } from "@cardstack/types";
          import Person from "https://localhost/base/models/person";
          import string from "https://cardstack.com/base/models/string";

          export default @adopts(Person) class User {
            @contains(string)
            username
          }`,
      });
      let card = {
        'schema.js': `
            import { adopts } from "@cardstack/types";
            import User from "https://localhost/base/models/user";

            export default @adopts(User) class Admin {}
        `,
      };
      let compiled = await compiler.compile(card);
      assert.equal(
        compiled.templateSources.embedded,
        `{{this.name}} was born on <FormatDate @date={{this.birthdate}} />`
      );
    });
  });

  module('errors', function () {
    test('@adopts cannot be used on a class property', async function (assert) {
      assert.expect(1);
      let card = {
        'schema.js': `
            import { adopts } from "@cardstack/types";
            import Person from "https://localhost/base/models/person";

            export default class Admin {
              @adopts(Person)
              user
            }
        `,
      };

      try {
        await compiler.compile(card);
      } catch (err) {
        assert.ok(
          /@adopts decorator can only be used on a class/.test(err.message),
          err.message
        );
      }
    });

    test('@adopts only accepts 1 argument', async function (assert) {
      assert.expect(1);
      let card = {
        'schema.js': `
            import { adopts } from "@cardstack/types";
            import Person from "https://localhost/base/models/person";

            export default @adopts(Person, true) class Admin {}
        `,
      };

      try {
        await compiler.compile(card);
      } catch (err) {
        assert.ok(
          /@adopts decorator accepts exactly one argument/.test(err.message),
          err.message
        );
      }
    });

    test('@adopts with wrong argument syntax', async function (assert) {
      assert.expect(1);
      let card = {
        'schema.js': `
            import { adopts } from "@cardstack/types";

            export default @adopts('Person') class Admin {}
        `,
      };

      try {
        await compiler.compile(card);
      } catch (err) {
        assert.ok(
          /@adopts argument must be an identifier/.test(err.message),
          err.message
        );
      }
    });

    test('@adopts doesnt accept undefined arguments', async function (assert) {
      assert.expect(1);
      let card = {
        'schema.js': `
            import { adopts } from "@cardstack/types";

            export default @adopts(Person) class Admin {}
        `,
      };

      try {
        await compiler.compile(card);
      } catch (err) {
        assert.ok(
          /@adopts argument is not defined/.test(err.message),
          err.message
        );
      }
    });

    test('@adopts argument must be imported', async function (assert) {
      assert.expect(1);
      let card = {
        'schema.js': `
            import { adopts } from "@cardstack/types";
            const Person = 'person'

            export default @adopts(Person) class Admin {}
        `,
      };

      try {
        await compiler.compile(card);
      } catch (err) {
        assert.ok(
          /@adopts argument must come from a module default export/.test(
            err.message
          ),
          err.message
        );
      }
    });
  });
});
