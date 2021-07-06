import { module, test, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { compileTemplate } from '../helpers/template-compiler';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupMirage } from 'ember-cli-mirage/test-support';
import setupCardMocking from '../helpers/card-mocking';
import Builder from 'cardhost/lib/builder';
import { RawCard, CompiledCard } from '@cardstack/core/src/interfaces';
import { baseCardURL } from '@cardstack/core/src/compiler';

async function evalModule(src: string): Promise<any> {
  //   return import(`data:application/javascript;base64,${btoa(src)}`);
  return src;
}

const PERSON_CARD = {
  url: 'https://mirage/cards/person',
  schema: 'schema.js',
  embedded: 'embedded.js',
  files: {
    'schema.js': `
      import { contains } from "@cardstack/types";
      import date from "https://cardstack.com/base/date";
      import string from "https://cardstack.com/base/string";
      export default class Person {
        @contains(string)
        name;

        @contains(date)
        birthdate;
      }`,
    'embedded.js': templateOnlyComponentTemplate(
      '<@fields.name/> was born on <@fields.birthdate/>'
    ),
  },
};

module('@core | compiler-basics', function (hooks) {
  let builder: Builder;

  setupRenderingTest(hooks);
  setupMirage(hooks);
  setupCardMocking(hooks);

  hooks.beforeEach(async function () {
    builder = new Builder();
  });

  skip('it has a working evalModule', async function (assert) {
    let schema = `
      export default function() {
        return "hello world"
      }
    `;
    let mod = await evalModule(schema);
    assert.equal(mod.default(), 'hello world');
  });

  test('we have a working in-browser template compiler for tests', async function (assert) {
    let compiled = compileTemplate(`<div class="it-works"></div>`);
    await render(compiled);
    assert.ok(document.querySelector('.it-works'));
  });

  test('can compile the base card', async function (assert) {
    let compiled = await builder.getCompiledCard(baseCardURL);
    console.log('COMPILED BASE CARD', compiled);

    assert.equal(compiled.url, baseCardURL, 'Includes basecard URL');
    assert.ok(compiled.schemaModule, 'base card has a model module');
    assert.notOk(compiled.adoptsFrom, 'No parent card listed');
    assert.deepEqual(compiled.fields, {}, 'No fields');
    assert.ok(
      compiled.isolated.moduleName.startsWith(`${baseCardURL}/isolated-`),
      'Isolated module exists'
    );
    assert.ok(
      compiled.embedded.moduleName.startsWith(`${baseCardURL}/embedded-`),
      'Embedded module exists'
    );
  });

  test('Names and defines a module for the model', async function (assert) {
    let card = {
      url: 'http://mirage/cards/post',
      schema: 'schema.js',
      files: {
        'schema.js': `export default class Post {}`,
      },
    };
    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    assert.equal(
      compiled.schemaModule,
      `${card.url}/schema.js`,
      'CompiledCard moduleName is set correctly'
    );
    let source = window.require(compiled.schemaModule).default;
    assert.equal(source.toString(), 'class Post {}', 'Source code is correct');
  });

  test('Generates inlineHBS for templates without', async function (assert) {
    let card = {
      url: 'http://mirage/cards/string',
      schema: 'schema.js',
      embedded: 'embedded.js',
      files: {
        'schema.js': `export default class String {}`,
        'embedded.js': templateOnlyComponentTemplate('{{@model}}'),
      },
    };
    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    assert.equal(
      compiled.embedded.inlineHBS,
      `{{@model}}`,
      'templateModules includes inlineHBS for simple cards'
    );
  });

  test('it discovers three kinds of fields', async function (assert) {
    await this.createCard(PERSON_CARD);
    let card = {
      url: 'http://mirage/cards/post',
      schema: 'schema.js',
      files: {
        'schema.js': `
          import { contains, belongsTo, containsMany, hasMany } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import date from "https://cardstack.com/base/date";
          import person from "https://mirage/cards/person";

          export default class Post {
            @contains(string)
            title;

            @belongsTo(person)
            author;

            @hasMany(date)
            date;

            foo = 'bar'
          }`,
      },
    };
    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    assert.deepEqual(Object.keys(compiled.fields), ['title', 'author', 'date']);
  });

  test('it discovers a string literal field', async function (assert) {
    let card = {
      url: 'http://mirage/cards/post',
      schema: 'schema.js',
      files: {
        'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";

        export default class Post {
          @contains(string)
          "title";
        }`,
      },
    };

    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    assert.deepEqual(Object.keys(compiled.fields), ['title']);
  });

  test('it discovers a field whose import comes before the field decorator', async function (assert) {
    let card = {
      url: 'http://mirage/cards/post',
      schema: 'schema.js',
      files: {
        'schema.js': `
        import string from "https://cardstack.com/base/string";
        import { contains } from "@cardstack/types";

        export default class Post {
          @contains(string)
          "title";
        }`,
      },
    };

    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    assert.deepEqual(Object.keys(compiled.fields), ['title']);
  });

  test('it discovers the field type of contains', async function (assert) {
    let card = {
      url: 'http://mirage/cards/post',
      schema: 'schema.js',
      files: {
        'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";

        export default class Post {
          @contains(string)
          title;
        }`,
      },
    };

    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    let title = compiled.fields.title;
    assert.equal(title.type, 'contains');
    assert.equal(title.card.url, 'https://cardstack.com/base/string');
  });

  module('data', function () {
    test('it accepts data and returns the values', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        data: {
          title: 'Hello World',
        },
        files: {
          'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";

          export default class Post {
            @contains(string)
            title;
          }`,
        },
      };

      this.createCard(card);

      let compiled = await builder.getCompiledCard(card.url);
      assert.deepEqual(compiled.data, { title: 'Hello World' });
    });
  });

  module('templates and styles', function (hooks) {
    let card: RawCard;
    let compiled: CompiledCard;

    hooks.beforeEach(async function () {
      card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        isolated: 'isolated.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";
            import styles from './isolated.css';

            export default class Post {
              @contains(string)
              title;
            }
          `,
          'isolated.js': templateOnlyComponentTemplate(
            '<div class="post-isolated><h1><@fields.title /></h1></div>'
          ),
          'isolated.css': '.post-isolated { background: red }',
        },
      };

      this.createCard(card);
      compiled = await builder.getCompiledCard(card.url);
    });

    test('it inlines a simple field template', async function (assert) {
      assert.ok(
        compiled.isolated.moduleName.startsWith(`${card.url}/isolated`),
        'templateModule for "isolated" is full url'
      );
    });

    test('it inlines a compound field template', async function (assert) {
      this.createCard(PERSON_CARD);

      let compiled = await builder.getCompiledCard(PERSON_CARD.url);
      assert.ok(
        compiled.embedded.moduleName.startsWith(`${PERSON_CARD.url}/embedded`),
        'templateModule for "embedded" is full url'
      );
      let source = window.require(compiled.embedded.moduleName).default;
      assert.equal(source.moduleName, '@glimmer/component/template-only');
    });
  });

  module('errors', function () {
    test('field must be called', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            function hi() {
              return contains;
            }
          `,
        },
      };
      this.createCard(card);
      assert.expect(1);
      try {
        await builder.getCompiledCard(card.url);
      } catch (err) {
        assert.ok(
          /the @contains decorator must be called/.test(err.message),
          err.message
        );
      }
    });

    test('field must be a decorator', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            function hi() {
              return contains(string);
            }
          `,
        },
      };
      assert.expect(1);
      this.createCard(card);
      try {
        await builder.getCompiledCard(card.url);
      } catch (err) {
        assert.ok(
          /the @contains decorator must be used as a decorator/.test(
            err.message
          ),
          err.message
        );
      }
    });

    test('field must be on a class property', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            @contains(string)
            class X {}
          `,
        },
      };
      assert.expect(1);
      try {
        this.createCard(card);

        await builder.getCompiledCard(card.url);
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
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            let myFieldName = 'title';
            class X {

              @contains(string)
              [myFieldName];
            }
          `,
        },
      };
      assert.expect(1);
      try {
        this.createCard(card);

        await builder.getCompiledCard(card.url);
      } catch (err) {
        assert.ok(
          /field names must not be dynamically computed/.test(err.message),
          err.message
        );
      }
    });

    test('field cannot be weird type', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            let myFieldName = 'title';
            class X {

              @contains(string)
              123;
            }
          `,
        },
      };
      assert.expect(1);
      try {
        this.createCard(card);

        await builder.getCompiledCard(card.url);
      } catch (err) {
        assert.ok(
          /field names must be identifiers or string literals/.test(
            err.message
          ),
          err.message
        );
      }
    });

    test('field with wrong number of arguments', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            class X {
              @contains(string, 1)
              title;
            }
          `,
        },
      };
      assert.expect(1);
      try {
        this.createCard(card);

        await builder.getCompiledCard(card.url);
      } catch (err) {
        assert.ok(
          /contains decorator accepts exactly one argument/.test(err.message),
          err.message
        );
      }
    });

    test('hasMany with wrong number of arguments', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { hasMany } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            class X {
              @hasMany(string, 1)
              title;
            }
          `,
        },
      };
      assert.expect(1);
      try {
        this.createCard(card);

        await builder.getCompiledCard(card.url);
      } catch (err) {
        assert.ok(
          /@hasMany decorator accepts exactly one argument/.test(err.message),
          err.message
        );
      }
    });

    test('field with wrong argument syntax', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";

            class X {

              @contains("string")
              title;
            }
          `,
        },
      };
      assert.expect(1);
      try {
        this.createCard(card);

        await builder.getCompiledCard(card.url);
      } catch (err) {
        assert.ok(
          /@contains argument must be an identifier/.test(err.message),
          err.message
        );
      }
    });

    test('field with undefined type', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";

            class X {
              @contains(string)
              title;
            }
          `,
        },
      };
      assert.expect(1);
      try {
        this.createCard(card);

        await builder.getCompiledCard(card.url);
      } catch (err) {
        assert.ok(
          /@contains argument is not defined/.test(err.message),
          err.message
        );
      }
    });

    test('field with card type that was not imported', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            let string = 'string';
            class X {
              @contains(string)
              title;
            }
          `,
        },
      };
      assert.expect(1);
      try {
        this.createCard(card);

        await builder.getCompiledCard(card.url);
      } catch (err) {
        assert.ok(
          /@contains argument must come from a module default export/.test(
            err.message
          ),
          err.message
        );
      }
    });
  });
});
