import {
  PERSON_RAW_CARD,
  ADDRESS_RAW_CARD,
} from '@cardstack/core/tests/helpers/fixtures';
import { module, test, skip } from 'qunit';
import { render } from '@ember/test-helpers';
import { compileTemplate } from '../helpers/template-compiler';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { setupCardTest } from '../helpers/setup';
import type {
  RawCard,
  CompiledCard,
  Builder,
} from '@cardstack/core/src/interfaces';
import { baseCardURL } from '@cardstack/core/src/compiler';
import { LOCAL_REALM } from 'cardhost/lib/builder';
import { cardURL } from '@cardstack/core/src/utils';

import type Cards from 'cardhost/services/cards';

async function evalModule(src: string): Promise<any> {
  //   return import(`data:application/javascript;base64,${btoa(src)}`);
  return src;
}

module('@core | compiler-basics', function (hooks) {
  let { createCard } = setupCardTest(hooks);

  let builder: Builder;
  let cardService: Cards;
  hooks.beforeEach(async function () {
    cardService = this.owner.lookup('service:cards');
    builder = await cardService.builder();
    createCard(ADDRESS_RAW_CARD);
    createCard(PERSON_RAW_CARD);
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

    assert.equal(compiled.url, baseCardURL, 'Includes basecard URL');
    assert.ok(compiled.schemaModule, 'base card has a model module');
    assert.notOk(compiled.adoptsFrom, 'No parent card listed');
    assert.deepEqual(compiled.fields, {}, 'No fields');
    assert.ok(
      await cardService.loadModule(
        compiled.componentInfos.isolated.componentModule.global
      ),
      'Isolated module exists'
    );
    assert.ok(
      await cardService.loadModule(
        compiled.componentInfos.embedded.componentModule.global
      ),
      'Embedded module exists'
    );
  });

  test('Names and defines a module for the model', async function (assert) {
    let card: RawCard = {
      id: PERSON_RAW_CARD.id,
      realm: PERSON_RAW_CARD.realm,
      schema: 'schema.js',
      files: {
        'schema.js': `export default class Post {}`,
      },
    };
    createCard(card);

    let compiled = await builder.getCompiledCard(cardURL(card));
    let source = await cardService.loadModule<any>(
      compiled.schemaModule.global
    );
    assert.equal(
      source.default.toString(),
      'class Post {}',
      'Source code is correct'
    );
  });

  test('Generates inlineHBS for templates without', async function (assert) {
    let card: RawCard = {
      id: 'string',
      realm: LOCAL_REALM,
      schema: 'schema.js',
      embedded: 'embedded.js',
      files: {
        'schema.js': `export default class String {}`,
        'embedded.js': templateOnlyComponentTemplate('{{@model}}'),
      },
    };
    createCard(card);

    let compiled = await builder.getCompiledCard(cardURL(card));
    assert.equal(
      compiled.componentInfos.embedded.inlineHBS,
      `{{@model}}`,
      'templateModules includes inlineHBS for simple cards'
    );
  });

  test('it discovers three kinds of fields', async function (assert) {
    await createCard(PERSON_RAW_CARD);
    let card: RawCard = {
      id: 'post',
      realm: LOCAL_REALM,
      schema: 'schema.js',
      files: {
        'schema.js': `
          import { contains, containsMany, linksTo } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import date from "https://cardstack.com/base/date";
          import person from "${LOCAL_REALM}person";

          export default class Post {
            @contains(string)
            title;

            @containsMany(person)
            author;

            @linksTo(date)
            date;

            foo = 'bar'
          }`,
      },
    };
    createCard(card);

    let compiled = await builder.getCompiledCard(cardURL(card));
    assert.deepEqual(Object.keys(compiled.fields), ['title', 'author', 'date']);
  });

  test('it discovers a string literal field', async function (assert) {
    let card: RawCard = {
      id: 'post',
      realm: LOCAL_REALM,
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

    createCard(card);

    let compiled = await builder.getCompiledCard(cardURL(card));
    assert.deepEqual(Object.keys(compiled.fields), ['title']);
  });

  test('it discovers a field whose import comes before the field decorator', async function (assert) {
    let card: RawCard = {
      id: 'post',
      realm: LOCAL_REALM,
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

    createCard(card);

    let compiled = await builder.getCompiledCard(cardURL(card));
    assert.deepEqual(Object.keys(compiled.fields), ['title']);
  });

  test('it discovers the field type of contains', async function (assert) {
    let card: RawCard = {
      id: 'post',
      realm: LOCAL_REALM,
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

    createCard(card);

    let compiled = await builder.getCompiledCard(cardURL(card));
    let title = compiled.fields.title;
    assert.equal(title.type, 'contains');
    assert.equal(title.card.url, 'https://cardstack.com/base/string');
  });

  module('data', function () {
    test('it accepts data and returns the values', async function (assert) {
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
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

      createCard(card);

      let raw = await builder.getRawCard(cardURL(card));
      assert.deepEqual(raw.data, { title: 'Hello World' });
    });
  });

  module('templates and styles', function (hooks) {
    let card: RawCard;
    let compiled: CompiledCard;

    hooks.beforeEach(async function () {
      card = {
        id: 'post',
        realm: LOCAL_REALM,
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

      createCard(card);
      compiled = await builder.getCompiledCard(cardURL(card));
    });

    test('it inlines a simple field template', async function (assert) {
      assert.ok(
        compiled.componentInfos.isolated.componentModule.global.includes(
          `/isolated`
        ),
        'templateModule for "isolated" is full url'
      );
    });

    test('it inlines a compound field template', async function (assert) {
      createCard(PERSON_RAW_CARD);

      let compiled = await builder.getCompiledCard(cardURL(PERSON_RAW_CARD));

      let code = await cardService.loadModule<any>(
        compiled.componentInfos.embedded.componentModule.global
      );

      assert.equal(code.default.moduleName, '@glimmer/component/template-only');
    });
  });

  module('errors', function () {
    test('field must be called', async function (assert) {
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
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
      createCard(card);
      assert.expect(1);
      try {
        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /the @contains decorator must be called/.test(err.message),
          err.message
        );
      }
    });

    test('field must be a decorator', async function (assert) {
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
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
      createCard(card);
      try {
        await builder.getCompiledCard(cardURL(card));
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
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
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
        createCard(card);

        await builder.getCompiledCard(cardURL(card));
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
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
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
        createCard(card);

        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /field names must not be dynamically computed/.test(err.message),
          err.message
        );
      }
    });

    test('field cannot be weird type', async function (assert) {
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
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
        createCard(card);

        await builder.getCompiledCard(cardURL(card));
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
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from "@cardstack/types";
            import string from "https://cardstack.com/base/string";

            class X {
              @contains(string, {}, 1)
              title;
            }
          `,
        },
      };
      assert.expect(1);
      try {
        createCard(card);

        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /contains decorator can only have between 1 and 2 arguments/.test(
            err.message
          ),
          err.message
        );
      }
    });

    test('field with wrong argument syntax', async function (assert) {
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
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
        createCard(card);

        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /@contains argument must be an identifier/.test(err.message),
          err.message
        );
      }
    });

    test('field with undefined type', async function (assert) {
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
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
        createCard(card);

        await builder.getCompiledCard(cardURL(card));
      } catch (err) {
        assert.ok(
          /@contains argument is not defined/.test(err.message),
          err.message
        );
      }
    });

    test('field with card type that was not imported', async function (assert) {
      let card: RawCard = {
        id: 'post',
        realm: LOCAL_REALM,
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
        createCard(card);

        await builder.getCompiledCard(cardURL(card));
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
