import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

class Article {
  constructor(title) {
    this.title = title;
  }
}
Article.modelName = 'article';

moduleForComponent('cardstack-content', 'Integration | Component | cardstack content', {
  integration: true,
  beforeEach() {
    this.register('template:components/cardstack/article-page', hbs`
      <h1>{{content.title}}</h1>
    `);
  }
});

test('it renders', function(assert) {
  this.set('content', new Article('Hello world'));
  this.render(hbs`{{cardstack-content content=content format="page"}}`);
  assert.equal(this.$('h1').text(), 'Hello world');
});
