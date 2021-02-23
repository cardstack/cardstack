import { module, test, todo } from 'qunit';
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
  });
});
