import QUnit from 'qunit';
import { CompiledCard } from '@cardstack/core/src/interfaces';
import transform, {
  Options,
} from '@cardstack/core/src/glimmer/card-template-plugin';
import {
  assert_isEqual,
  equalIgnoringWhiteSpace,
} from '@cardstack/core/tests/helpers/assertions';
import { TestBuilder } from '../helpers/test-builder';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';

function importAndChooseName() {
  return 'BestGuess';
}

QUnit.module('Glimmer CardTemplatePlugin', function (hooks) {
  let builder: TestBuilder;
  let options: Options;
  let defaultFieldFormat: Options['defaultFieldFormat'];
  let usageMeta: Options['usageMeta'];
  let compiledStringCard: CompiledCard,
    compiledDateCard: CompiledCard,
    compiledListCard: CompiledCard;

  hooks.before(async function () {
    builder = new TestBuilder();
    builder.addRawCard({
      url: 'https://mirage/card/list',
      schema: 'schema.js',
      files: {
        'schema.js': `
          import { contains, containsMany } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import date from "https://cardstack.com/base/date";
          export default class NestedItems {
            @contains(string)
            name;

            @containsMany(string)
            items;

            @containsMany(date)
            dates;
          }`,
      },
    });
    compiledListCard = await builder.getCompiledCard(
      'https://mirage/card/list'
    );
    compiledStringCard = await builder.getCompiledCard(
      'https://cardstack.com/base/string'
    );
    compiledDateCard = await builder.getCompiledCard(
      'https://cardstack.com/base/date'
    );
  });

  hooks.beforeEach(function () {
    usageMeta = { model: new Set(), fields: new Map() };
    defaultFieldFormat = 'embedded';
  });

  QUnit.module('Primitive Fields', function () {
    QUnit.test('string-like', async function (assert) {
      let template = transform('{{@model}}', {
        fields: {},
        usageMeta,
        defaultFieldFormat,
        importAndChooseName,
      });
      assert.equal(template, '{{@model}}');

      assert.equal(usageMeta['model'], 'self');
      assert_isEqual(usageMeta['fields'], new Map());
    });

    QUnit.test('date-like', async function (assert) {
      let template = transform('<FormatDate @date={{@model}} />', {
        fields: {},
        usageMeta,
        defaultFieldFormat,
        importAndChooseName,
      });
      assert.equal(template, '<FormatDate @date={{@model}} />');
      assert.equal(usageMeta['model'], 'self');
      assert_isEqual(usageMeta['fields'], new Map());
    });
  });

  QUnit.module('Fields: contains', function () {
    QUnit.test('Simple embeds', async function (assert) {
      let template = transform('<@fields.title />', {
        fields: {
          title: {
            card: compiledStringCard,
            name: 'title',
            type: 'contains',
          },
        },
        usageMeta,
        defaultFieldFormat,
        importAndChooseName,
      });

      assert.equal(
        template,
        '{{@model.title}}',
        'Component invocation is converted to handlebars expression'
      );
      assert_isEqual(usageMeta['model'], new Set());
      assert_isEqual(
        usageMeta['fields'],
        new Map([['title', defaultFieldFormat]])
      );
    });

    QUnit.test('simple model usage', async function (assert) {
      let template = transform('{{helper @model.title}}', {
        fields: {
          title: {
            card: compiledStringCard,
            name: 'title',
            type: 'contains',
          },
        },
        usageMeta,
        defaultFieldFormat,
        importAndChooseName,
      });

      assert.equal(
        template,
        '{{helper @model.title}}',
        'Component invocation is converted to handlebars expression'
      );
      assert_isEqual(usageMeta['model'], new Set(['title']));
      assert_isEqual(usageMeta['fields'], new Map());
    });

    QUnit.test('Embedding with imports', async function (assert) {
      let template = transform('<@fields.createdAt />', {
        fields: {
          createdAt: {
            type: 'contains',
            card: compiledDateCard,
            name: 'createdAt',
          },
        },
        usageMeta,
        defaultFieldFormat,
        importAndChooseName,
      });

      assert.equal(template, '<BestGuess @model={{@model.createdAt}} />');
      assert_isEqual(usageMeta['model'], new Set());
      assert_isEqual(
        usageMeta['fields'],
        new Map([['createdAt', defaultFieldFormat]])
      );
    });

    QUnit.test('Nested fields', async function (assert) {
      let template = transform('<@fields.title /><@fields.list.name />', {
        fields: {
          title: {
            card: compiledStringCard,
            name: 'title',
            type: 'contains',
          },
          list: {
            card: compiledListCard,
            name: 'list',
            type: 'contains',
          },
        },
        usageMeta,
        defaultFieldFormat,
        importAndChooseName,
      });

      assert.equal(
        template,
        '{{@model.title}}{{@model.list.name}}',
        'Component invocation is converted to handlebars expression'
      );
      assert_isEqual(usageMeta['model'], new Set());
      assert_isEqual(
        usageMeta['fields'],
        new Map([
          ['title', defaultFieldFormat],
          ['list.name', defaultFieldFormat],
        ])
      );
    });
  });

  QUnit.module('Fields: inlinable: containsMany', function (hooks) {
    hooks.beforeEach(function () {
      options = {
        fields: {
          items: {
            card: compiledStringCard,
            name: 'items',
            type: 'containsMany',
          },
          list: {
            card: compiledListCard,
            name: 'list',
            type: 'contains',
          },
        },
        usageMeta,
        defaultFieldFormat,
        importAndChooseName,
      };
    });

    QUnit.test('each-as loops for strings', async function (assert) {
      assert.equal(
        transform(
          '{{#each @fields.items as |Item|}}{{#if condition}}<Item />{{/if}}<Other />{{/each}}',
          options
        ),
        '{{#each @model.items as |Item|}}{{#if condition}}{{Item}}{{/if}}<Other />{{/each}}'
      );
      assert_isEqual(usageMeta['model'], new Set(), 'No @model usage meta');
      assert_isEqual(
        usageMeta['fields'],
        new Map([['items', defaultFieldFormat]]),
        'items as @field meta'
      );
    });

    QUnit.test(
      'each-as loops for strings in nested cards',
      async function (assert) {
        assert.equal(
          transform(
            '{{#each @fields.list.items as |Item|}}{{#if condition}}<Item />{{/if}}<Other />{{/each}}',
            options
          ),
          '{{#each @model.list.items as |Item|}}{{#if condition}}{{Item}}{{/if}}<Other />{{/each}}'
        );
        assert_isEqual(usageMeta['model'], new Set());
        assert_isEqual(
          usageMeta['fields'],
          new Map([['list.items', defaultFieldFormat]])
        );
      }
    );

    QUnit.test('Compononet invocation for strings', async function (assert) {
      let template = transform('<@fields.items />', options);

      assert.equal(
        template,
        '{{#each @model.items as |item|}}{{item}}{{/each}}'
      );
      assert_isEqual(usageMeta['model'], new Set());
      assert_isEqual(
        usageMeta['fields'],
        new Map([['items', defaultFieldFormat]])
      );
    });

    QUnit.test(
      'Compononet invocation for nested fields',
      async function (assert) {
        let template = transform('<@fields.list.items />', options);

        assert.equal(
          template,
          '{{#each @model.list.items as |item|}}{{item}}{{/each}}'
        );
        assert_isEqual(usageMeta['model'], new Set());
        assert_isEqual(
          usageMeta['fields'],
          new Map([['list.items', defaultFieldFormat]])
        );
      }
    );
  });

  QUnit.module('Fields: not-inlinable: containsMany', function (hooks) {
    hooks.beforeEach(function () {
      options = {
        fields: {
          items: {
            name: 'items',
            card: compiledDateCard,
            type: 'containsMany',
          },
          list: {
            name: 'list',
            card: compiledListCard,
            type: 'contains',
          },
        },
        usageMeta,
        importAndChooseName,
        defaultFieldFormat,
      };
    });

    QUnit.test('each-as loops for dates', async function (assert) {
      assert.equal(
        transform(
          '{{#each @fields.items as |Item|}}<Item />{{/each}}',
          options
        ),
        '{{#each @model.items as |Item|}}<BestGuess @model={{Item}} />{{/each}}'
      );
      assert_isEqual(usageMeta['model'], new Set());
      assert_isEqual(
        usageMeta['fields'],
        new Map([['items', defaultFieldFormat]])
      );
    });

    QUnit.test(
      'each-as loops for dates in nested card',
      async function (assert) {
        assert.equal(
          transform(
            '{{#each @fields.list.dates as |ADate|}}<ADate />{{/each}}',
            options
          ),
          '{{#each @model.list.dates as |ADate|}}<BestGuess @model={{ADate}} />{{/each}}'
        );
        assert_isEqual(usageMeta['model'], new Set());
        assert_isEqual(
          usageMeta['fields'],
          new Map([['list.dates', defaultFieldFormat]])
        );
      }
    );

    QUnit.test('component invocation for dates', async function (assert) {
      assert.equal(
        transform('<@fields.items />', options),
        '{{#each @model.items as |item|}}<BestGuess @model={{item}} />{{/each}}'
      );
      assert_isEqual(usageMeta['model'], new Set());
      assert_isEqual(
        usageMeta['fields'],
        new Map([['items', defaultFieldFormat]])
      );
    });

    QUnit.test(
      'component invocation for dates in nested card',
      async function (assert) {
        assert.equal(
          transform('<@fields.list.dates />', options),
          '{{#each @model.list.dates as |date|}}<BestGuess @model={{date}} />{{/each}}'
        );
        assert_isEqual(usageMeta['model'], new Set());
        assert_isEqual(
          usageMeta['fields'],
          new Map([['list.dates', defaultFieldFormat]])
        );
      }
    );
  });

  QUnit.test('Tracking deeply nested field usage', async function () {
    builder.addRawCard({
      url: 'http://mirage/cards/post',
      schema: 'schema.js',
      isolated: 'isolated.js',
      files: {
        'schema.js': `
        import { contains } from "@cardstack/types";
        import string from "https://cardstack.com/base/string";
        import date from "https://cardstack.com/base/date";

        export default class Hello {
          @contains(string)
          title;

          @contains(date)
          createdAt;
        }
      `,
        'isolated.js': templateOnlyComponentTemplate(
          `<h1><@fields.title /></h1><h2><@fields.createdAt /></h2>`
        ),
        'embedded.js': templateOnlyComponentTemplate(
          `<h2><@fields.title /> - <@fields.createdAt /></h2>`
        ),
      },
    });
    let template = `{{#each @fields.posts as |Post|}}<Post />{{/each}}`;
    builder.addRawCard({
      url: 'http://mirage/cards/post-list',
      schema: 'schema.js',
      isolated: 'isolated.js',
      data: {
        posts: [
          {
            title: 'A blog post title',
            createdAt: '2021-05-17T15:31:21+0000',
          },
        ],
      },
      files: {
        'schema.js': `
        import { containsMany } from "@cardstack/types";
        import post from "http://mirage/cards/post";

        export default class Hello {
          @containsMany(post)
          posts;
        }
      `,
        'isolated.js': templateOnlyComponentTemplate(template),
      },
    });

    let card = await builder.getCompiledCard('http://mirage/cards/post-list');
    transform(template, {
      fields: card.fields,
      usageMeta,
      defaultFieldFormat,
      importAndChooseName,
    });
    assert_isEqual(usageMeta['model'], new Set());
    assert_isEqual(
      usageMeta['fields'],
      new Map([['posts', defaultFieldFormat]])
    );
  });

  QUnit.module('@fields API', function (hooks) {
    hooks.beforeEach(function () {
      options = {
        fields: {
          title: {
            type: 'contains',
            card: compiledStringCard,
            name: 'title',
          },
          startDate: {
            type: 'contains',
            card: compiledDateCard,
            name: 'startDate',
          },
          items: {
            type: 'containsMany',
            card: compiledStringCard,
            name: 'items',
          },
          events: {
            type: 'containsMany',
            card: compiledDateCard,
            name: 'events',
          },
        },
        usageMeta,
        defaultFieldFormat,
        importAndChooseName,
      };
    });

    // Reminder: as we wrote this, we decided that `<@fields.startDate />` can
    // just always replace `<@model.startDate />` for the invocation case, and
    // `{{@model.startDate}}` is *always* only the data.
    QUnit.test('{{#each-in}} over fields', async function () {
      equalIgnoringWhiteSpace(
        transform(
          `
            <Whatever @name={{name}} />
            {{#each-in @fields as |name Field|}}
              <label>{{name}}</label>
              <Field />
           {{/each-in}}
           <Whichever @field={{Field}} />
           `,
          options
        ),
        `
          <Whatever @name={{name}} />
          <label>{{"title"}}</label>
         {{@model.title}}
         <label>{{"startDate"}}</label>
         <BestGuess @model={{@model.startDate}} />
         <label>{{"items"}}</label>
         {{#each @model.items as |item|}}{{item}}{{/each}}
         <label>{{"events"}}</label>
         {{#each @model.events as |event|}}<BestGuess @model={{event}} />{{/each}}
         <Whichever @field={{Field}} />
         `
      );
      assert_isEqual(usageMeta['model'], new Set());
      assert_isEqual(
        usageMeta['fields'],
        new Map([
          ['title', defaultFieldFormat],
          ['startDate', defaultFieldFormat],
          ['items', defaultFieldFormat],
          ['events', defaultFieldFormat],
        ])
      );
    });
  });

  QUnit.test('Avoids rewriting shadowed vars', async function () {
    equalIgnoringWhiteSpace(
      transform(
        `{{#each @fields.birthdays as |Birthday|}}
              <Birthday />
              {{#let (whatever) as |Birthday|}}
                <Birthday />
              {{/let}}
           {{/each}}`,
        {
          usageMeta,
          importAndChooseName,
          defaultFieldFormat,
          fields: {
            birthdays: {
              name: 'birthdays',
              card: compiledDateCard,
              type: 'containsMany',
            },
          },
        }
      ),
      `{{#each @model.birthdays as |Birthday|}}
          <BestGuess @model={{Birthday}} />
          {{#let (whatever) as |Birthday|}}
            <Birthday />
          {{/let}}
        {{/each}}`
    );
    assert_isEqual(usageMeta['model'], new Set());
    assert_isEqual(
      usageMeta['fields'],
      new Map([['birthdays', defaultFieldFormat]])
    );
  });

  QUnit.test(
    'Errors when you wrap a field invocation in a helper',
    async function (assert) {
      assert.throws(function () {
        transform(
          '{{#each (helper @fields.items) as |Item|}}<Item />{{/each}}',
          options
        );
      }, /Invalid use of @fields API/);
    }
  );

  QUnit.test(
    'Errors when trying to pass @fields API through helper',
    async function (assert) {
      assert.throws(function () {
        transform(
          `{{#each-in (some-helper @fields) as |name Field|}}
              <label>{{name}}</label>
             {{/each-in}}`,
          options
        );
      }, /Invalid use of @fields API/);
    }
  );

  QUnit.test(
    'Errors when using @fields as a component argument',
    async function (assert) {
      assert.throws(function () {
        transform(`<SomeCompontent @arrg={{@fields}} />`, options);
      }, /Invalid use of @fields API/);
    }
  );

  QUnit.test(
    'Errors when calling @fields as a element node',
    async function (assert) {
      assert.throws(function () {
        transform(`<@fields />`, options);
      }, /Invalid use of @fields API/);
    }
  );

  QUnit.test(
    'Errors when using @fields in a each loop',
    async function (assert) {
      assert.throws(
        function () {
          transform(
            `{{#each @fields as |Field|}}
              <label>{{name}}</label>
             {{/each}}`,
            options
          );
        },
        /Invalid use of @fields API/,
        'Errors when used with an each loops'
      );
    }
  );

  QUnit.test(
    'Errors when using @fields as path expression',
    async function (assert) {
      assert.throws(
        function () {
          transform(
            `{{#each-in @fields as |name Field|}}
                  <label>{{name}}</label>
                  <Field />
                  {{@fields}}
               {{/each-in}}`,
            options
          );
        },
        /Invalid use of @fields API/,
        'Errors when fields is used incorrectly inside of a valid use of fields'
      );
    }
  );
});
