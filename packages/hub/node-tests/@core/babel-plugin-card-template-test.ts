import transformCardComponent, {
  CardComponentPluginOptions as CardTemplateOptions,
} from '@cardstack/core/src/babel-plugin-card-template';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { ADDRESS_RAW_CARD, PERSON_RAW_CARD } from '@cardstack/core/tests/helpers/fixtures';
import { CompiledCard } from '@cardstack/core/src/interfaces';
import { ProjectTestRealm, setupCardBuilding, TEST_REALM } from '../helpers/cards';
import type CardBuilder from '../../services/card-builder';

if (process.env.COMPILER) {
  describe('Babel CardTemplatePlugin', function () {
    let builder: CardBuilder;
    let realm: ProjectTestRealm;
    let options: CardTemplateOptions;
    let personCard: CompiledCard;
    let code: string;

    let { createRealm, getCardBuilder } = setupCardBuilding(this);

    this.beforeEach(async () => {
      realm = createRealm(TEST_REALM);
      builder = getCardBuilder();

      realm.addRawCard(ADDRESS_RAW_CARD);
      realm.addRawCard(PERSON_RAW_CARD);
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

    it('updates usedFields on options', async function () {
      expect(options.usedFields, 'usedFields lists out all the used fields').to.deep.equal([
        'name',
        'birthdate',
        'address.street',
        'address.city',
        'address.state',
        'address.zip',
        'address.settlementDate',
      ]);
    });

    it('modifies the source', async function () {
      expect(code).to.containsSource(
        // eslint-disable-next-line no-useless-escape
        `import BaseModel from \"@cardstack/core/src/card-model\";`
      );
      expect(code).to.containsSource(
        `export class Model extends BaseModel {
      static serializerMap = {
        date: ["birthdate", "address.settlementDate"]
      };
    }`
      );
    });
  });
}
