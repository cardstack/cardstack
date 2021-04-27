import QUnit from 'qunit';
import { ComponentInfo } from '../../src/interfaces';
import transform from './../../src/glimmer/card-template-plugin';
import { COMPILED_STRING_CARD, COMPILED_DATE_CARD } from '../helpers/fixtures';

QUnit.module('Glimmer CardTemplatePlugin', function (hooks) {
  let usedFields: ComponentInfo['usedFields'];

  hooks.beforeEach(function () {
    usedFields = [];
  });

  QUnit.module('base cards', function () {
    QUnit.test('string-card', async function (assert) {
      let template = transform('<@model.title />', {
        fields: {
          title: {
            type: 'contains',
            card: COMPILED_STRING_CARD,
            localName: 'title',
          },
        },
        usedFields,
        importAndChooseName() {
          return 'nothing';
        },
      });

      assert.equal(
        template,
        '{{@model.title}}',
        'Component invocation is converted to handlebars expression'
      );
      assert.deepEqual(usedFields, ['title']);
    });

    QUnit.test('date card', async function (assert) {
      let template = transform('<@model.createdAt />', {
        fields: {
          createdAt: {
            type: 'contains',
            card: COMPILED_DATE_CARD,
            localName: 'createdAt',
          },
        },
        usedFields,
        importAndChooseName() {
          return 'BestGuess';
        },
      });

      assert.equal(template, '<BestGuess @model={{@model.createdAt}} />');
      assert.deepEqual(usedFields, ['createdAt']);
    });
  });
});
