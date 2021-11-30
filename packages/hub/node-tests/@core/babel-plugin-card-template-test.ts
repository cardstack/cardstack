import transformCardComponent, {
  CardComponentPluginOptions as CardTemplateOptions,
} from '@cardstack/core/src/babel-plugin-card-template';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { ADDRESS_RAW_CARD, PERSON_RAW_CARD } from '@cardstack/core/tests/helpers/fixtures';
import { CompiledCard } from '@cardstack/core/src/interfaces';
import type CardBuilder from '../../services/card-builder';
import { setupHub } from '../helpers/server';
import { cardHelpers, configureCompiler } from '../helpers/cards';

if (process.env.COMPILER) {
  describe('Babel CardTemplatePlugin', function () {
    let builder: CardBuilder;
    let options: CardTemplateOptions;
    let personCard: CompiledCard;
    let code: string;

    configureCompiler(this);
    let { getContainer } = setupHub(this);
    let { cards } = cardHelpers(this);

    this.beforeEach(async () => {
      builder = await getContainer().lookup('card-builder');

      await cards.create(ADDRESS_RAW_CARD);
      await cards.create(PERSON_RAW_CARD);
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
