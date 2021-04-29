import QUnit from 'qunit';
import { ComponentInfo } from '../../src/interfaces';
import transform from './../../src/glimmer/card-template-plugin';
import { COMPILED_STRING_CARD, COMPILED_DATE_CARD } from '../helpers/fixtures';

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
            type: 'contains',
            card: COMPILED_STRING_CARD,
            localName: 'title',
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
            localName: 'createdAt',
          },
        },
        usedFields,
        importAndChooseName,
      });

      assert.equal(template, '<BestGuess @model={{@model.createdAt}} />');
      assert.deepEqual(usedFields, ['createdAt']);
    });
  });

  QUnit.module('Fields: containsMany', function () {
    QUnit.test('each-as loops for strings', async function (assert) {
      let template = transform(
        '{{#each @model.items as |Item|}}<Item />{{/each}}',
        {
          fields: {
            items: {
              type: 'containsMany',
              card: COMPILED_STRING_CARD,
              localName: 'items',
            },
          },
          usedFields,
          importAndChooseName,
        }
      );

      assert.equal(
        template,
        '{{#each @model.items as |Item|}}{{Item}}{{/each}}'
      );
      assert.deepEqual(usedFields, ['items']);
    });

    QUnit.only('Compononet invocation for strings', async function (assert) {
      let template = transform('<@model.items />', {
        fields: {
          items: {
            type: 'containsMany',
            card: COMPILED_STRING_CARD,
            localName: 'items',
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

    QUnit.test('each-as loops for dates', async function (assert) {
      let template = transform(
        '{{#each @model.items as |Item|}}<Item />{{/each}}',
        {
          fields: {
            items: {
              type: 'containsMany',
              card: COMPILED_DATE_CARD,
              localName: 'items',
            },
          },
          usedFields,
          importAndChooseName,
        }
      );

      assert.equal(
        template,
        '{{#each @model.items as |item|}}<BestGuess @model={{item}} />{{/each}}'
      );
      assert.deepEqual(usedFields, ['items']);
    });

    QUnit.test('component invocation for dates', async function (assert) {
      let template = transform('<@model.items />', {
        fields: {
          items: {
            type: 'containsMany',
            card: COMPILED_DATE_CARD,
            localName: 'items',
          },
        },
        usedFields,
        importAndChooseName,
      });

      assert.equal(
        template,
        '{{#each @model.items as |item|}}<BestGuess @model={{item}} />{{/each}}'
      );
      assert.deepEqual(usedFields, ['items']);
    });
  });
});
