import QUnit from 'qunit';
import { ComponentInfo } from '../../src/interfaces';
import transform, { Options } from './../../src/glimmer/card-template-plugin';
import { COMPILED_STRING_CARD, COMPILED_DATE_CARD } from '../helpers/fixtures';
import { equalIgnoringWhiteSpace } from '../helpers/assertions';

function importAndChooseName() {
  return 'BestGuess';
}

QUnit.module('Glimmer CardTemplatePlugin', function (hooks) {
  let usedFields: ComponentInfo['usedFields'];

  hooks.beforeEach(function () {
    usedFields = [];
  });

  QUnit.module('Fields: contains', function () {
    QUnit.test('Simple embeds', async function (assert) {
      let template = transform('<@model.title />', {
        fields: {
          title: {
            card: COMPILED_STRING_CARD,
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
      let template = transform('<@model.createdAt />', {
        fields: {
          createdAt: {
            type: 'contains',
            card: COMPILED_DATE_CARD,
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
    let options: Options;
    hooks.beforeEach(function () {
      options = {
        fields: {
          items: {
            card: COMPILED_STRING_CARD,
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
      let template = transform('<@model.items />', {
        fields: {
          items: {
            card: COMPILED_STRING_CARD,
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
    let options: Options;
    hooks.beforeEach(function () {
      options = {
        fields: {
          items: {
            name: 'items',
            card: COMPILED_DATE_CARD,
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
        transform('<@model.items />', options),
        '{{#each @model.items as |item|}}<BestGuess @model={{item}} />{{/each}}'
      );
      assert.deepEqual(usedFields, ['items']);
    });
  });

  QUnit.module('@fields API', function (hooks) {
    let options: Options;

    hooks.beforeEach(function () {
      options = {
        fields: {
          title: {
            type: 'contains',
            card: COMPILED_STRING_CARD,
            name: 'title',
          },
          startDate: {
            type: 'contains',
            card: COMPILED_DATE_CARD,
            name: 'startDate',
          },
          items: {
            type: 'containsMany',
            card: COMPILED_STRING_CARD,
            name: 'items',
          },
          events: {
            type: 'containsMany',
            card: COMPILED_DATE_CARD,
            name: 'events',
          },
        },
        usedFields,
        importAndChooseName,
      };
    });

    // Reminder: as we wrote this, we decided that `<@fields.startDate />` can
    // just always replace `<@model.startDate />` for the invocation case, and
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
  });
});
