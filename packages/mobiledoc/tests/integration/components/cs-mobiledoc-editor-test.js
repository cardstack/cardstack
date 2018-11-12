import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sleep from '../../helpers/sleep';
import { insertText } from '../../helpers/ember-mobiledoc-editor';

module('Integration | Component | cs mobiledoc editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('sample', {
      version: '0.3.0',
      atoms: [],
      cards: [],
      markups: [],
      sections: [[1, 'p', [[0, [], 0, 'First paragraph.']]]],
    });
    await render(hbs`{{cs-mobiledoc-editor mobiledoc=sample}}`);
    assert.equal(
      this.$()
        .text()
        .trim(),
      'First paragraph.',
    );
  });

  test('mobiledoc is updated', async function(assert) {
    let actualDoc;
    let expectedDoc = {
      version: '0.3.1',
      atoms: [],
      cards: [],
      markups: [],
      sections: [[1, 'p', [[0, [], 0, 'I am a paragraph.']]]],
    };

    this.actions = {
      onChange: mobiledoc => {
        actualDoc = mobiledoc;
      },
    };

    await render(hbs`{{cs-mobiledoc-editor on-change=(action 'onChange')}}`);
    assert.equal(
      this.$()
        .text()
        .trim(),
      '',
    );

    await insertText(this.element.querySelector('.mobiledoc-editor__editor'), 'I am a paragraph.');
    await sleep(1000); // wait for debounce

    assert.equal(
      this.$()
        .text()
        .trim(),
      'I am a paragraph.',
    );
    assert.deepEqual(actualDoc, expectedDoc, 'mobiledoc is updated');
  });
});
