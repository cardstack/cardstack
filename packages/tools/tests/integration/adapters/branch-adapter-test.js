import { moduleForComponent, test } from 'ember-qunit';
import DS from 'ember-data';
import Branchable from '@cardstack/tools/mixins/branch-adapter';
import RSVP from 'rsvp';
import Ember from 'ember';

let requests, answers;

moduleForComponent('branch-adapter', 'Integration | Adapter | branch-adapter', {
  integration: true,
  beforeEach() {
    requests = [];
    answers = [];
    this.register('service:cardstack-routing', Ember.Service.extend({
      defaultBranch: 'a'
    }));
    this.register('adapter:post', DS.JSONAPIAdapter.extend(Branchable, {
      shouldBackgroundReloadRecord() {
        return false;
      },
      ajax(url, type, options) {
        requests.push({ url, type, options });
        return RSVP.resolve(answers.shift());
      }
    }));
    this.register('model:post', DS.Model.extend());
    this.inject.service('store');
  }
});

test('findRecord on default branch', function(assert) {
  answers.push({
    data: {
      id: 1,
      type: 'posts'
    }
  });
  return RSVP.resolve()
    .then(() => this.get('store').findRecord('post', 1))
    .then(record => {
      assert.equal(record.id, 1);
      assert.deepEqual(requests[0].url, '/posts/1');
    });
});

test('findRecord on a branch', function(assert) {
  answers.push({
    data: {
      id: 1,
      type: 'posts'
    }
  });
  return RSVP.resolve()
    .then(() => this.get('store').findRecord('post', 1, { adapterOptions: { branch: 'x' } }))
    .then(record => {
      assert.equal(record.id, 1);
      assert.deepEqual(requests[0].url, '/posts/1?branch=x');
    });
});

test('findRecord leaves off explicitly requested default branch', function(assert) {
  answers.push({
    data: {
      id: 1,
      type: 'posts'
    }
  });
  return RSVP.resolve()
    .then(() => this.get('store').findRecord('post', 1, { adapterOptions: { branch: 'a' } }))
    .then(record => {
      assert.equal(record.id, 1);
      assert.deepEqual(requests[0].url, '/posts/1');
    });
});


test('findRecord caches on same branch', function(assert) {
  answers.push({
    data: {
      id: 1,
      type: 'posts'
    }
  });
  answers.push({
    data: {
      id: 1,
      type: 'posts'
    }
  });
  return RSVP.resolve()
    .then(() => this.get('store').findRecord('post', 1, { adapterOptions: { branch: 'x' } }))
    .then(() => {
      assert.equal(requests.length, 1);
      return this.get('store').findRecord('post', 1, { adapterOptions: { branch: 'x' } });
    }).then(() => {
      assert.equal(requests.length, 1, "no additional request");
    });
});

test('findRecord does not cache when branch changes', function(assert) {
  answers.push({
    data: {
      id: 1,
      type: 'posts'
    }
  });
  answers.push({
    data: {
      id: 1,
      type: 'posts'
    }
  });
  return RSVP.resolve()
    .then(() => this.get('store').findRecord('post', 1, { adapterOptions: { branch: 'x' } }))
    .then(() => {
      assert.equal(requests.length, 1);
      return this.get('store').findRecord('post', 1, { adapterOptions: { branch: 'y' } });
    }).then(() => {
      assert.equal(requests.length, 2, "saw a new request");
    });
});

test('queryRecord with default branch', function(assert) {
  answers.push({
    data: [{
      id: 1,
      type: 'posts'
    }]
  });
  return RSVP.resolve()
    .then(() => this.get('store').queryRecord('post', { filter: { slug: 'hi' } } ))
    .then(record => {
      assert.equal(record.id, 1);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, '/posts');
      assert.deepEqual(requests[0].options, {
        data: {
          filter: { slug: 'hi' },
          page: { size: 1 }
        } });
    });
});

test('queryRecord with explicit branch', function(assert) {
  answers.push({
    data: [{
      id: 1,
      type: 'posts'
    }]
  });
  return RSVP.resolve()
    .then(() => this.get('store').queryRecord('post', { branch: 'x', filter: { slug: 'hi' } } ))
    .then(record => {
      assert.equal(record.id, 1);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, '/posts');
      assert.deepEqual(requests[0].options, {
        data: {
          branch: 'x',
          filter: { slug: 'hi' },
          page: { size: 1 }
        } });
    });
});

test('queryRecord with explicit branch matching default', function(assert) {
  answers.push({
    data: [{
      id: 1,
      type: 'posts'
    }]
  });
  return RSVP.resolve()
    .then(() => this.get('store').queryRecord('post', { branch: 'a', filter: { slug: 'hi' } } ))
    .then(record => {
      assert.equal(record.id, 1);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, '/posts');
      assert.deepEqual(requests[0].options, {
        data: {
          filter: { slug: 'hi' },
          page: { size: 1 }
        } });
    });
});
