import QUnit from 'qunit';
import { CompiledCard, ComponentInfo } from '@cardstack/core/src/interfaces';
import transform, {
  Options,
} from '@cardstack/core/src/glimmer/card-template-plugin';
import { equalIgnoringWhiteSpace } from '@cardstack/core/tests/helpers/assertions';
import { TestBuilder } from '../helpers/test-builder';

function importAndChooseName() {
  return 'BestGuess';
}

QUnit.module('Glimmer CardTemplatePlugin', function (hooks) {
  let options: Options;
  let usedFields: ComponentInfo['usedFields'];
  let compiledStringCard: CompiledCard, compiledDateCard: CompiledCard;

  hooks.before(async function () {
    let builder = new TestBuilder();
    compiledStringCard = await builder.getCompiledCard(
      'https://cardstack.com/base/string'
    );
    compiledDateCard = await builder.getCompiledCard(
      'https://cardstack.com/base/date'
    );
  });

  hooks.beforeEach(function () {
    usedFields = [];
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
        usedFields,
        importAndChooseName,
      });

      assert.equal(
        template,
        '{{@model.title}}',
        'Component invocation is converted to handlebars expression'
      );
      assert.deepEqual(usedFields, ['title']);
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
        usedFields,
        importAndChooseName,
      });

      assert.equal(template, '<BestGuess @model={{@model.createdAt}} />');
      assert.deepEqual(usedFields, ['createdAt']);
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
        },
        usedFields,
        importAndChooseName,
      };
    });

    QUnit.test(
      'each-as loops for strings with shallow depth',
      async function (assert) {
        assert.equal(
          transform(
            '{{#each @model.items as |Item|}}<Item />{{/each}}',
            options
          ),
          '{{#each @model.items as |Item|}}{{Item}}{{/each}}'
        );
        assert.deepEqual(usedFields, ['items']);
      }
    );

    QUnit.test(
      'each-as loops for strings with greater depth',
      async function (assert) {
        assert.equal(
          transform(
            '{{#each @model.items as |Item|}}{{#if condition}}<Item />{{/if}}<Other />{{/each}}',
            options
          ),
          '{{#each @model.items as |Item|}}{{#if condition}}{{Item}}{{/if}}<Other />{{/each}}'
        );
        assert.deepEqual(usedFields, ['items']);
      }
    );

    QUnit.test(
      'each-as loop with helper as loop argument',
      async function (assert) {
        let template = transform(
          '{{#each (helper @model.items) as |Item|}}<Item />{{/each}}',
          options
        );

        assert.equal(
          template,
          '{{#each (helper @model.items) as |Item|}}{{Item}}{{/each}}'
        );
        assert.deepEqual(usedFields, ['items']);
      }
    );

    QUnit.test('Compononet invocation for strings', async function (assert) {
      let template = transform('<@fields.items />', {
        fields: {
          items: {
            card: compiledStringCard,
            name: 'items',
            type: 'containsMany',
          },
        },
        usedFields,
        importAndChooseName,
      });

      assert.equal(
        template,
        '{{#each @model.items as |item|}}{{item}}{{/each}}'
      );
      assert.deepEqual(usedFields, ['items']);
    });
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
        },
        usedFields,
        importAndChooseName,
      };
    });

    QUnit.test('each-as loops for dates', async function (assert) {
      assert.equal(
        transform('{{#each @model.items as |Item|}}<Item />{{/each}}', options),
        '{{#each @model.items as |Item|}}<BestGuess @model={{Item}} />{{/each}}'
      );
      assert.deepEqual(usedFields, ['items']);
    });

    QUnit.test('component invocation for dates', async function (assert) {
      assert.equal(
        transform('<@fields.items />', options),
        '{{#each @model.items as |item|}}<BestGuess @model={{item}} />{{/each}}'
      );
      assert.deepEqual(usedFields, ['items']);
    });
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
        usedFields,
        importAndChooseName,
      };
    });

    // Reminder: as we wrote this, we decided that `<@fields.startDate />` can
    // just always replace `<@fields.startDate />` for the invocation case, and
    // `{{@model.startDate}}` is *always* only the data.
    QUnit.test('{{#each-in}} over @fields', async function () {
      equalIgnoringWhiteSpace(
        transform(
          `{{#each-in @fields as |name Field|}}
              <label>{{name}}</label>
              <Field />
           {{/each-in}}`,
          options
        ),
        `<label>{{"title"}}</label>
         {{@model.title}}
         <label>{{"startDate"}}</label>
         <BestGuess @model={{@model.startDate}} />
         <label>{{"items"}}</label>
         {{#each @model.items as |item|}}{{item}}{{/each}}
         <label>{{"events"}}</label>
         {{#each @model.events as |event|}}<BestGuess @model={{event}} />{{/each}}
         `
      );
    });

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
      'Errors when using fields anywhere other than #each loop',
      async function (assert) {
        assert.throws(function () {
          transform(`<SomeCompontent @arrg={{@fields}} />`, options);
        }, /Invalid use of @fields API/);

        assert.throws(function () {
          transform(`<@fields />`, options);
        }, /Invalid use of @fields API/);

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
});
