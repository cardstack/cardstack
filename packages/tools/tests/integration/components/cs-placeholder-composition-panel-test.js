import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-placeholder-composition-panel', 'Integration | Component | cs placeholder composition panel', {
  integration: true,
  beforeEach() {
    this.inject.service('store');
    this.set('content', {
      isCardstackPlaceholder: true,
      type: 'page',
      slug: 'somewhere',
      branch: 'x'
    });
  }
});

test('it renders', function(assert) {
  this.render(hbs`{{cs-placeholder-composition-panel content=content}}`);
  assert.equal(this.$('.content-title').text().trim(), 'Not found');
});
