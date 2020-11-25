import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, waitForTestsToEnd } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/hub';
import { embeddedCssFile } from '@cardstack/cardhost/utils/scaffolding';

const csRealm = `http://localhost:3000/api/realms/default`;
const masterRecordingTemplate = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'master-recording-template',
    csFieldSets: {
      embedded: ['title'],
      isolated: ['title', 'label'],
    },
    csFeatures: { 'embedded-css': embeddedCssFile },
    csFiles: {
      [embeddedCssFile]: 'master recording css',
    },
    csTitle: 'Master Recording Template',
  })
  .withField('title', 'string-field')
  .withField('label', 'string-field')
  .withField('musical-work', 'base');
const hasMany = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'has-many',
    csFiles: {
      'compute.js': `// eslint-disable-next-line
      export default async function({ field, card }) {
        let foreignKey = await field.value('foreignKey');
        let foreignType = await field.value('foreignType');
        console.log(foreignKey, foreignType);
        try {
          let found = await card.reader.search({
            filter: {
              type: { csRealm: foreignType.csRealm, csId: foreignType.csId },
              eq: {
               [foreignKey + '.csId']:  card.csId,
               [foreignKey + '.csRealm']:  card.csRealm,
               [foreignKey + '.csOriginalRealm']:  card.csOriginalRealm
              },
            },
          });
          return { value: found.cards };
        } catch (err) {
          return { value: [] };
        }
      }`,
    },
    csFeatures: { compute: 'compute.js' },
  })
  .withField('foreignKey', 'string-field')
  .withField('foreignType', 'base');
const relatedRecordings = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'related-recordings',
    csTitle: 'Related Recordings',
  })
  .withRelationships({ foreignType: masterRecordingTemplate })
  .adoptingFrom(hasMany);
const musicalWorkTemplate = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'musical-work-template',
    csFieldSets: {
      embedded: ['title'],
      isolated: ['title', 'iswc', 'musical-work', 'related-recordings'],
    },
    csFeatures: { 'embedded-css': embeddedCssFile },
    csFiles: { [embeddedCssFile]: 'musical work css' },
    csTitle: 'Musical Work Template',
  })
  .withField('title', 'string-field')
  .withField('iswc', 'string-field')
  .withField('related-recordings', relatedRecordings, 'plural', { foreignKey: 'musical-work' });

const work = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'work-change-is-good',
    title: 'Change Is Good',
    iswc: 'T-030245162-3',
    csTitle: 'Musical Work',
  })
  .adoptingFrom(musicalWorkTemplate);
const recording = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'recording-change-is-good',
    title: 'Change Is Good',
    label: 'Bunny Records',
    csTitle: 'Master Recording',
  })
  .withRelationships({ 'musical-work': work })
  .adoptingFrom(masterRecordingTemplate);

const scenario = new Fixtures({
  create: [musicalWorkTemplate, masterRecordingTemplate, hasMany, relatedRecordings, work, recording],
});

module('Acceptance | related cards', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test(`viewing related-works sidebar`, async function(assert) {
    await visit(`/cards/${encodeURIComponent(recording.canonicalURL)}`);
    await waitForCardLoad();

    assert.dom('[data-test-related-cards]').exists();
    assert.dom('[data-test-related-cards-title]').hasText('Related Works');
    assert.dom('[data-test-related-cards] [data-test-card-renderer-embedded]').exists({ count: 1 });

    await percySnapshot(assert);
  });

  test(`viewing related-recordings sidebar`, async function(assert) {
    await visit(`/cards/${encodeURIComponent(work.canonicalURL)}`);
    await waitForCardLoad();

    assert.dom('[data-test-related-cards]').exists();
    assert.dom('[data-test-related-cards-title]').hasText('Related Recordings');
    assert.dom('[data-test-related-cards] [data-test-card-renderer-embedded]').exists({ count: 1 });

    await percySnapshot(assert);
  });
});
