import { RawCard } from './../../core/src/interfaces';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

import rawLoader from './helpers/raw-loader-helper';
const REALM = 'https://cardstack.com/cards/base';

Qmodule('Card Compiler', function () {
  test('placeholder test', async function (assert) {
    // PONDER: raw.json? Is that the best?
    const stats = await rawLoader('fixtures/string-card/raw.json', {
      realm: REALM,
    });
    const output = stats.toJson({ source: true }).modules![0].source!;
    const outputJson = JSON.parse(output);

    const expectedOutput: RawCard = {
      url: `${REALM}/string-card`,
      files: {
        'schema.js': 'export default class StringCard {}',
        'embedded.js': `import { setComponentTemplate } from "@ember/component";
import { precompileTemplate } from "@ember/template-compilation";
import templateOnlyComponent from "@ember/component/template-only";
export default setComponentTemplate(
  precompileTemplate("{{@model}}", {
    strictMode: true,
  }),
  templateOnlyComponent()
);`,
      },
    };

    assert.equal(outputJson.url, expectedOutput.url);
    assert.equal(
      outputJson.files['schema.js'].trim(),
      expectedOutput.files['schema.js']
    );
    assert.equal(
      outputJson.files['embedded.js'].trim(),
      expectedOutput.files['embedded.js']
    );
  });
});
