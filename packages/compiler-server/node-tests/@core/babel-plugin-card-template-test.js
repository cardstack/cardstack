"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_builder_1 = require("../helpers/test-builder");
const babel_plugin_card_template_1 = __importDefault(require("@cardstack/core/src/babel-plugin-card-template"));
const templates_1 = require("@cardstack/core/tests/helpers/templates");
const fixtures_1 = require("@cardstack/core/tests/helpers/fixtures");
describe('Babel CardTemplatePlugin', function () {
    let builder;
    let options;
    let personCard;
    let code;
    this.beforeAll(async function () {
        builder = new test_builder_1.TestBuilder();
        builder.addRawCard(fixtures_1.ADDRESS_RAW_CARD);
        builder.addRawCard(fixtures_1.PERSON_RAW_CARD);
        personCard = await builder.getCompiledCard(fixtures_1.PERSON_RAW_CARD.url);
        options = {
            fields: personCard.fields,
            cardURL: personCard.url,
            inlineHBS: undefined,
            defaultFieldFormat: 'embedded',
            usedFields: [],
        };
        let src = templates_1.templateOnlyComponentTemplate('<div><h1><@fields.name /></h1><@fields.birthdate /> <@fields.address /></div>');
        code = babel_plugin_card_template_1.default(src, options);
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
        `import BaseModel from \"@cardstack/core/src/card-model\";`);
        expect(code).to.containsSource(`export class Model extends BaseModel {
      static serializerMap = {
        date: ["birthdate", "address.settlementDate"]
      };
    }`);
    });
});
//# sourceMappingURL=babel-plugin-card-template-test.js.map