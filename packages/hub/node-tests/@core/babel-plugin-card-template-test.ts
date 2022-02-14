import transformCardComponent, {
  CardComponentPluginOptions as CardTemplateOptions,
} from '@cardstack/core/src/babel-plugin-card-template';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { CompiledCard } from '@cardstack/core/src/interfaces';
import { configureHubWithCompiler } from '../helpers/cards';
import { ADDRESS_RAW_CARD } from '@cardstack/core/tests/helpers';

if (process.env.COMPILER) {
  describe('Babel CardTemplatePlugin', function () {
    let options: CardTemplateOptions;
    let personCard: CompiledCard;
    let code: string;

    let { cards, realmURL } = configureHubWithCompiler(this);

    this.beforeEach(async () => {
      await cards.create(ADDRESS_RAW_CARD);

      personCard = (
        await cards.create({
          realm: realmURL,
          id: 'person',
          schema: 'schema.js',
          isolated: 'isolated.js',
          files: {
            'schema.js': `
              import { contains } from "@cardstack/types";
              import string from "https://cardstack.com/base/string";
              import date from "https://cardstack.com/base/date";
	            import address from "https://cardstack.local/address";

              export default class Person {
                @contains(string) name;
                @contains(date) birthdate;
                @contains(address) address;

                @contains(string)
                async fullName() {
                  return await 'Mr. ' + await this.name;
                }
              }
            `,
            'isolated.js': templateOnlyComponentTemplate(
              `<div class="person-isolated" data-test-person>Hi! I am <@fields.name/></div>`,
              { IsolatedStyles: './isolated.css' }
            ),
            'isolated.css': '.person-isolated { background: red }',
          },
        })
      ).compiled;

      options = {
        fields: personCard.fields,
        debugPath: personCard.url,
        inlineHBS: undefined,
        defaultFieldFormat: 'embedded',
        usedFields: [],
      };
      let src = templateOnlyComponentTemplate(
        '<div><h1><@fields.name /><@fields.fullName /></h1><@fields.birthdate /> <@fields.address /></div>'
      );

      code = transformCardComponent(src, options).source;
    });

    it('updates usedFields on options', async function () {
      expect(options.usedFields, 'usedFields lists out all the used fields').to.deep.equal([
        'name',
        'fullName',
        'birthdate',
        'address.street',
        'address.city',
        'address.state',
        'address.zip',
        'address.settlementDate',
      ]);
    });

    it('adds an import for the cards needed Serializer', async function () {
      expect(code).to.containsSource(`
        import { DateSerializer } from "@cardstack/core/src/serializers";
      `);
    });

    it('can make a function to get options used to create a card model', async function () {
      expect(code).to.containsSource(`
        export function getCardModelOptions() {
          return {
            serializerMap: {
              "birthdate": DateSerializer,
              "address.settlementDate": DateSerializer
            },
            computedFields: ["fullName"],
            usedFields: ["name", "fullName", "birthdate", "address.street", "address.city", "address.state", "address.zip", "address.settlementDate"]
          };
        }
      `);
    });
  });
}
