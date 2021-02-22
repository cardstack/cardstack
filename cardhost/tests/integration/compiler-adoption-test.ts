import { module, test, todo } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { Compiler } from '@cardstack/core';

module('Integration | compiler-adoption', function (hooks) {
  setupRenderingTest(hooks);

  let compiler = new Compiler();

  hooks.beforeEach(async function () {});

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
