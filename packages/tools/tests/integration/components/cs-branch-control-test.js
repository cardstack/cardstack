import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import Ember from 'ember';

moduleForComponent('cs-branch-control', 'Integration | Component | cs branch control', {
  integration: true,
  beforeEach() {
    this.register('service:cardstack-tools', Ember.Service.extend({
      branch: 'master',
      init() {
        this._super();
        this.branchSets = [];
      },
      setBranch(which) {
        this.branchSets.push(which);
        this.set('branch', which);
      }
    }));
    this.inject.service('cardstack-tools', { as: 'tools' });
  }
});

test('it renders in live mode', function(assert) {
  this.render(hbs`{{cs-branch-control}}`);
  assert.equal(this.$('button.active').text().trim(), 'Live');
});

test('it renders in preview mode', function(assert) {
  this.get('tools').set('branch', 'b');
  this.render(hbs`{{cs-branch-control}}`);
  assert.equal(this.$('button.active').text().trim(), 'Preview');
});

test('it enters preview', function(assert) {
  this.render(hbs`{{cs-branch-control}}`);
  Ember.run(() => {
    this.$('button:contains(Preview)').click();
  });
  assert.deepEqual(this.get('tools.branchSets'), ['draft']);
  assert.equal(this.$('button.active').text().trim(), 'Preview');
});

test('it enters live', function(assert) {
  this.get('tools').set('branch', 'b');
  this.render(hbs`{{cs-branch-control}}`);
  Ember.run(() => {
    this.$('button:contains(Live)').click();
  });
  assert.deepEqual(this.get('tools.branchSets'), ['master']);
  assert.equal(this.$('button.active').text().trim(), 'Live');
});
