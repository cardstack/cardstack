import QUnit from 'qunit';
import { TestBuilder } from '../helpers/test-builder';
import transformCardComponent, {
  CardComponentPluginOptions as CardTemplateOptions,
} from '@cardstack/core/src/babel-plugin-card-template';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import {
  assert_isEqual,
  containsSource,
} from '@cardstack/core/tests/helpers/assertions';
import {
  ADDRESS_RAW_CARD,
  PERSON_RAW_CARD,
} from '@cardstack/core/tests/helpers/fixtures';
import { CompiledCard } from '@cardstack/core/src/interfaces';

QUnit.module('Babel CardTemplatePlugin', function (hooks) {
  let builder: TestBuilder;
  let options: CardTemplateOptions;
  let personCard: CompiledCard;
  let code: string;

  hooks.before(async function () {
    builder = new TestBuilder();

    builder.addRawCard(ADDRESS_RAW_CARD);
    builder.addRawCard(PERSON_RAW_CARD);
    personCard = await builder.getCompiledCard(PERSON_RAW_CARD.url);

    options = {
      fields: personCard.fields,
      cardURL: personCard.url,
      inlineHBS: undefined,
      defaultFieldFormat: 'embedded',
      usedFields: [],
    };
    let src = templateOnlyComponentTemplate(
      '<div><h1><@fields.name /></h1><@fields.birthdate /> <@fields.address /></div>'
    );

    code = transformCardComponent(src, options);
  });

  QUnit.test('updates usedFields on options', async function () {
    assert_isEqual(
      options.usedFields,
      [
        'name',
        'birthdate',
        'address.street',
        'address.city',
        'address.state',
        'address.zip',
        'address.settlementDate',
      ],
      'usedFields lists out all the used fields'
    );
  });

  QUnit.test('modifies the source', async function () {
    containsSource(
      code,
      // eslint-disable-next-line no-useless-escape
      `import BaseModel from \"@cardstack/core/src/base-component-model\";`
    );
    containsSource(
      code,
      `export class Model extends BaseModel {
        serializerMap = {
          date: ["birthdate", "address.settlementDate"]
        };
      }`
    );
  });
});
