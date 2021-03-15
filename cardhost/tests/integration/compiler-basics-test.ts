import { module, test, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { compileTemplate } from '../helpers/template-compiler';
import { setupMirage } from 'ember-cli-mirage/test-support';
import setupCardMocking from '../helpers/card-mocking';
import Builder from 'cardhost/lib/builder';

async function evalModule(src: string): Promise<any> {
  //   return import(`data:application/javascript;base64,${btoa(src)}`);
  return src;
}

module('Integration | compiler-basics', function (hooks) {
  let builder: Builder;

  setupRenderingTest(hooks);
  setupMirage(hooks);
  setupCardMocking(hooks);

  hooks.beforeEach(async function () {
    builder = new Builder();

    await this.createCard({
      url: 'https://mirage/cards/person',
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
      'embedded.hbs': `<@model.name/> was born on <@model.birthdate/>`,
    });
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

  test('it discovers the four kinds of fields', async function (assert) {
    let card = {
      url: 'http://mirage/cards/post',
      'schema.js': `
        import { contains, belongsTo, containsMany, hasMany } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";
        import comment from "https://cardstack.com/base/models/comment";
        import tag from "https://cardstack.com/base/models/tag";
        import person from "https://mirage/cards/person";

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
    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    assert.deepEqual(Object.keys(compiled.fields), [
      'title',
      'author',
      'tags',
      'comments',
    ]);
  });

  test('it discovers a string literal field', async function (assert) {
    let card = {
      url: 'http://mirage/cards/post',
      'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";

        export default class Post {
          @contains(string)
          "title";
        }
    `,
    };

    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    assert.deepEqual(Object.keys(compiled.fields), ['title']);
  });

  test('it discovers a field whose import comes before the field decorator', async function (assert) {
    let card = {
      url: 'http://mirage/cards/post',
      'schema.js': `
        import string from "https://cardstack.com/base/models/string";
        import { contains } from "@cardstack/types";

        export default class Post {
          @contains(string)
          "title";
        }
    `,
    };

    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    assert.deepEqual(Object.keys(compiled.fields), ['title']);
  });

  test('it discovers the field type of contains', async function (assert) {
    let card = {
      url: 'http://mirage/cards/post',
      'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";

        export default class Post {
          @contains(string)
          title;
        }
    `,
    };

    this.createCard(card);

    let compiled = await builder.getCompiledCard(card.url);
    let title = compiled.fields.title;
    assert.equal(title.type, 'contains');
    assert.equal(title.card.url, 'https://cardstack.com/base/models/string');
  });

  module('data', function () {
    test('it accepts data.json and returns the values', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        'data.json': {
          attributes: {
            title: 'Hello World',
          },
        },
        'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/models/string";

          export default class Post {
            @contains(string)
            title;
          }
      `,
      };

      this.createCard(card);

      let compiled = await builder.getCompiledCard(card.url);
      assert.deepEqual(compiled.data, { title: 'Hello World' });
    });
  });

  module('templates', function () {
    test('it inlines a simple field template', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/models/string";

        export default class Post {
          @contains(string)
          title;
        }
    `,
        'isolated.hbs': `<h1><@model.title /></h1>`,
      };

      this.createCard(card);

      let compiled = await builder.getCompiledCard(card.url);
      assert.equal(
        compiled.templateSources.isolated,
        `<h1>{{@model.title}}</h1>`
      );
    });

    test('it inlines a compound field template', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        'schema.js': `
        import { contains } from "@cardstack/types";
        import person from "https://mirage/cards/person";

        export default class Post {
          @contains(person)
          author;
        }
    `,
        'isolated.hbs': `<h1><@model.author /></h1>`,
      };

      this.createCard(card);

      let compiled = await builder.getCompiledCard(card.url);
      assert.equal(
        compiled.templateSources.isolated,
        // TODO: Have this base card include a unrelated component
        // `<h1>{{@model.author.name}} was born on <FormatDate @date={{@model.author.birthdate}} /></h1>`
        `<h1>{{@model.author.name}} was born on Date: {{@model.author.birthdate}}</h1>`
      );
    });
  });

  module('errors', function () {
    test('field must be called', async function (assert) {
      let card = {
        url: 'http://mirage/cards/post',
        'schema.js': `
    import { contains } from "@cardstack/types";
    function hi() {
      return contains;
    }
    `,
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
        'schema.js': `
    import { contains } from "@cardstack/types";
    import string from "https://cardstack.com/base/models/string";

    function hi() {
      return contains(string);
    }
    `,
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
        'schema.js': `
    import { contains } from "@cardstack/types";
    import string from "https://cardstack.com/base/models/string";

    @contains(string)
    class X {}
    `,
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
        'schema.js': `
    import { contains } from "@cardstack/types";
    import string from "https://cardstack.com/base/models/string";

    class X {
      @contains(string, 1)
      title;
    }
    `,
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
        'schema.js': `
    import { hasMany } from "@cardstack/types";
    import string from "https://cardstack.com/base/models/string";

    class X {
      @hasMany(string, 1)
      title;
    }
    `,
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
        'schema.js': `
    import { contains } from "@cardstack/types";

    class X {

      @contains("string")
      title;
    }
    `,
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
        'schema.js': `
    import { contains } from "@cardstack/types";

    class X {
      @contains(string)
      title;
    }
    `,
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
        'schema.js': `
    import { contains } from "@cardstack/types";
    let string = 'string';
    class X {
      @contains(string)
      title;
    }
    `,
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
