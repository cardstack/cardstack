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

  test('it discovers an identifier field', async function (assert) {
    let card = {
      'schema.js': `
        import { field } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";

        export default class Post {
          @field(string)
          title;
        }
    `,
    };

    let compiler = new Compiler();
    let compiled = await compiler.compile(card);
    assert.deepEqual(Object.keys(compiled.fields), ['title']);
  });

  test('it discovers a string literal field', async function (assert) {
    let card = {
      'schema.js': `
        import { field } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";

        export default class Post {
          @field(string)
          "title";
        }
    `,
    };

    let compiler = new Compiler();
    let compiled = await compiler.compile(card);
    assert.deepEqual(Object.keys(compiled.fields), ['title']);
  });

  test('field must be called', async function (assert) {
    let card = {
      'schema.js': `
      import { field } from "@cardstack/types";
      function hi() {
        return field;
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /the field decorator must be called/.test(err.message),
        err.message
      );
    }
  });

  test('field must be a decorator', async function (assert) {
    let card = {
      'schema.js': `
      import { field } from "@cardstack/types";
      function hi() {
        return field('xxx');
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /the field decorator must be used as a decorator/.test(err.message),
        err.message
      );
    }
  });

  test('field must be on a class property', async function (assert) {
    let card = {
      'schema.js': `
      import { field } from "@cardstack/types";
      @field('hi')
      class X {}
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /the field decorator can only go on class properties/.test(err.message),
        err.message
      );
    }
  });

  test('field must have static name', async function (assert) {
    let card = {
      'schema.js': `
      import { field } from "@cardstack/types";
      let myFieldName = 'title';
      class X {

        @field(1)
        [myFieldName];
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /field names must not be dynamically computed/.test(err.message),
        err.message
      );
    }
  });

  test('field cannot be weird type', async function (assert) {
    let card = {
      'schema.js': `
      import { field } from "@cardstack/types";
      let myFieldName = 'title';
      class X {

        @field(1)
        123;
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /field names must be identifiers or string literals/.test(err.message),
        err.message
      );
    }
  });
});
