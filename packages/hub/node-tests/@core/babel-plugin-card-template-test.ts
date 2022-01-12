import transformCardComponent, {
  CardComponentPluginOptions as CardTemplateOptions,
} from '@cardstack/core/src/babel-plugin-card-template';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { ADDRESS_RAW_CARD, PERSON_RAW_CARD } from '@cardstack/core/tests/helpers/fixtures';
import { CompiledCard } from '@cardstack/core/src/interfaces';
import { configureHubWithCompiler } from '../helpers/cards';

if (process.env.COMPILER) {
  describe('Babel CardTemplatePlugin', function () {
    let options: CardTemplateOptions;
    let personCard: CompiledCard;
    let code: string;

    let { cards } = configureHubWithCompiler(this);

    this.beforeEach(async () => {
      await cards.create(ADDRESS_RAW_CARD);
      personCard = (await cards.create(PERSON_RAW_CARD)).compiled;

      options = {
        fields: personCard.fields,
        debugPath: personCard.url,
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

    it.only('modifies the source', async function () {
      expect(code).to.containsSource(
        // eslint-disable-next-line no-useless-escape
        `export Model from \"@cardstack/core/src/card-model\";`
      );
      expect(code).to.containsSource(
        `export const serializerMap = {
          date: ["birthdate", "address.settlementDate"]
        };`
      );
    });
  });
}
