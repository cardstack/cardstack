import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { Compiler } from '@cardstack/core';

module('Integration | compiler-basics', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    let schema = `
      import { field } from "@cardstack/types";
      import string from "hub:https://cardstack.com/base/string";

      export default class Post {
        @field(string)
        title;
      }
    `;

    let compiler = new Compiler();
    let outputModule = await compiler.compileSchema(schema);

    assert.equal(outputModule, 'hello');
  });
});
