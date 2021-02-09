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

  test('it discovers an identifier contains', async function (assert) {
    let card = {
      'schema.js': `
        import { contains, belongsTo, containsMany, hasMany } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";
        import person from "https://localhost/base/models/person";
        import comment from "https://localhost/base/models/comment";
        import tag from "https://localhost/base/models/tag";

        export default class Post {
          @contains(string)
          title;

          @containsMany(tag)
          tags;

          @belongsTo(person)
          author;

          @hasMany(comment)
          comments;

          foo = 'bar'
        }
    `,
    };

    let compiler = new Compiler();
    let compiled = await compiler.compile(card);
    assert.deepEqual(Object.keys(compiled.fields), [
      'title',
      'author',
      'tags',
      'comments',
    ]);
  });

  test('it discovers a string literal field for contains', async function (assert) {
    let card = {
      'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";

        export default class Post {
          @contains(string)
          "title";
        }
    `,
    };

    let compiler = new Compiler();
    let compiled = await compiler.compile(card);
    assert.deepEqual(Object.keys(compiled.fields), ['title']);
  });

  test('it discovers the field type of contains', async function (assert) {
    let card = {
      'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";

        export default class Post {
          @contains(string)
          title;
        }
    `,
    };

    let compiler = new Compiler();
    let compiled = await compiler.compile(card);
    let title = compiled.fields.title;
    assert.equal(title.type, 'contains');
    assert.equal(title.card.url, 'https://cardstack.com/base/models/string');
  });

  test('field must be called', async function (assert) {
    let card = {
      'schema.js': `
      import { contains } from "@cardstack/types";
      function hi() {
        return contains;
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /the @contains decorator must be called/.test(err.message),
        err.message
      );
    }
  });

  test('field must be a decorator', async function (assert) {
    let card = {
      'schema.js': `
      import { contains } from "@cardstack/types";
      import string from "https://cardstack.com/base/models/string";

      function hi() {
        return contains(string);
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /the @contains decorator must be used as a decorator/.test(err.message),
        err.message
      );
    }
  });

  test('field must be on a class property', async function (assert) {
    let card = {
      'schema.js': `
      import { contains } from "@cardstack/types";
      import string from "https://cardstack.com/base/models/string";

      @contains(string)
      class X {}
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /the @contains decorator can only go on class properties/.test(
          err.message
        ),
        err.message
      );
    }
  });

  test('field must have static name', async function (assert) {
    let card = {
      'schema.js': `
      import { contains } from "@cardstack/types";
      import string from "https://cardstack.com/base/models/string";

      let myFieldName = 'title';
      class X {

        @contains(string)
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
      import { contains } from "@cardstack/types";
      import string from "https://cardstack.com/base/models/string";

      let myFieldName = 'title';
      class X {

        @contains(string)
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

  test('field with wrong number of arguments', async function (assert) {
    let card = {
      'schema.js': `
      import { contains } from "@cardstack/types";
      import string from "https://cardstack.com/base/models/string";

      class X {
        @contains(string, 1)
        title;
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /contains decorator accepts exactly one argument/.test(err.message),
        err.message
      );
    }
  });

  test('hasMany with wrong number of arguments', async function (assert) {
    let card = {
      'schema.js': `
      import { hasMany } from "@cardstack/types";
      import string from "https://cardstack.com/base/models/string";

      class X {
        @hasMany(string, 1)
        title;
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /@hasMany decorator accepts exactly one argument/.test(err.message),
        err.message
      );
    }
  });

  test('field with wrong argument syntax', async function (assert) {
    let card = {
      'schema.js': `
      import { contains } from "@cardstack/types";

      class X {

        @contains("string")
        title;
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /card type must be an identifier/.test(err.message),
        err.message
      );
    }
  });

  test('field with undefined type', async function (assert) {
    let card = {
      'schema.js': `
      import { contains } from "@cardstack/types";

      class X {
        @contains(string)
        title;
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(/card type is not defined/.test(err.message), err.message);
    }
  });

  test('field with card type that was not imported', async function (assert) {
    let card = {
      'schema.js': `
      import { contains } from "@cardstack/types";
      let string = 'string';
      class X {
        @contains(string)
        title;
      }
      `,
    };
    let compiler = new Compiler();
    assert.expect(1);
    try {
      await compiler.compile(card);
    } catch (err) {
      assert.ok(
        /card type must come from a module default export/.test(err.message),
        err.message
      );
    }
  });

  test('it inlines a field template', async function (assert) {
    let card = {
      'schema.js': `
        import { field } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";

        export default class Post {
          @field(string)
          title;
        }
    `,
      'isolated.hbs': `
      <h1><this.title /></h1>
    `,
    };

    let compiler = new Compiler();
    let compiled = await compiler.compile(card);
    assert.equal(compiled.templateSources.isolated, `<h1>{{this.title}}</h1>`);
  });
});
