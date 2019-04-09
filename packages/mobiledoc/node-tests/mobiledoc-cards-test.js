const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { createReadStream, readdirSync } = require('fs');
const path = require('path');

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');

const mobiledoc = { "version": "0.3.1", "atoms": [], "cards": [["cs-mobiledoc-card", { "card": { "id": "e252cbe3d8181bb14f68c7a78c776bdc494d7b37", "type": "cardstack-image" } }], ["cs-mobiledoc-card", { "card": { "id": "627a28a74fe9d2aaf44ebeaa689ecba46dd44079", "type": "cardstack-image" } }]], "markups": [], "sections": [[1, "p", [[0, [], 0, "This is a test"]]], [10, 0], [1, "p", [[0, [], 0, "this is another card"]]], [10, 1], [1, "p", [[0, [], 0, "blah"]]]] };

describe('mobiledoc/mobiledoc-cards computed tests', function () {
  let env, article;
  async function setup() {
    let factory = new JSONAPIFactory();

    let models = [];
    readdirSync(path.join(__dirname, './images')).forEach(filename => {
      let readStream = createReadStream(path.join(__dirname, 'images', filename));

      readStream.type = 'cardstack-files';
      readStream.id = filename.replace(/\..+/, '');
      let pathSegments = filename.split('/');
      readStream['filename'] = pathSegments[pathSegments.length - 1];

      models.push(readStream);

      models.forEach(file => {
        factory.addResource('cardstack-images', file.id)
          .withRelated('file', file);
      });
    });

    factory.addResource('data-sources', 'files')
      .withAttributes({
        'source-type': '@cardstack/files',
        params: {
          storeFilesIn: { type: 'data-sources', id: 'default-data-source' }
        }
      });

    factory.addResource('data-sources', 'images')
      .withAttributes({
        'source-type': '@cardstack/image',
        params: {
          storeImageMetadataIn: { type: 'data-sources', id: 'default-data-source' }
        }
      });

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'body').withAttributes({ fieldType: '@cardstack/mobiledoc' }),

        factory.addResource('computed-fields', 'mobiledoc-cards')
          .withAttributes({
            computedFieldType: '@cardstack/mobiledoc::mobiledoc-cards',
            params: {
              mobiledocFields: ['body']
            }
          }),
      ]);

    article = factory.addResource('articles', '1')
      .withAttributes({
        body: mobiledoc
      });

    env = await createDefaultEnvironment(`${__dirname}/../`, factory.getModels().concat(models));
  }

  async function teardown() {
    await destroyDefaultEnvironment(env);
  }

  describe('read-only', function () {
    before(setup);
    after(teardown);

    it('can derive relationships to cards embedded within mobiledoc', async function () {
      let { data: model } = await env.lookup('hub:searchers').getCard(env.session, 'articles', article.id);
      expect(model.relationships['mobiledoc-cards'].data).to.eql([
        { type: 'cardstack-images', id: 'e252cbe3d8181bb14f68c7a78c776bdc494d7b37'},
        { type: 'cardstack-images', id: '627a28a74fe9d2aaf44ebeaa689ecba46dd44079'},
      ])
    });
  });
});