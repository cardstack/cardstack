import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { Compiler } from '@cardstack/core';

function evalModule(src: string): Promise<any> {
  return import(`data:application/javascript;base64,${btoa(src)}`);
}

module('Integration | compiler-basics', function (hooks) {
  setupRenderingTest(hooks);

  test('it has a working evalModule', async function (assert) {
    let schema = `
      export default function() {
        return "hello world"
      }
    `;
    let mod = await evalModule(schema);
    assert.equal(mod.default(), 'hello world');
  });

  test('it discovers a field', async function (assert) {
    let card = {
      'schema.js': `
        import { field } from "@cardstack/types";
        import string from "hub:https://cardstack.com/base/string";

        export default class Post {
          @field(string)
          title;
        }
    `,
    };

    let compiler = new Compiler();
    let compiled = await compiler.compile(card);

    let Model = await evalModule(compiled.modelSource);
    assert.equal(Model.fields, ['title']);
  });
});
