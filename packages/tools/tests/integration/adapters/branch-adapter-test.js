import { moduleForComponent, test } from 'ember-qunit';
import DS from 'ember-data';
import Branchable from '@cardstack/tools/mixins/branch-adapter';
import Adapter from 'ember-resource-metadata/adapter';
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
    this.register('adapter:post', Adapter.extend(Branchable, {
      shouldBackgroundReloadRecord() {
        return false;
      },
      ajax(url, type, options) {
        requests.push({ url, type, options });
        if (answers.length === 0) {
          throw new Error("more requests than expected");
        }
        return RSVP.resolve(answers.shift());
      }
    }));
    this.register('model:post', DS.Model.extend());
    this.inject.service('store');
    this.inject.service('resource-metadata', { as: 'meta' });
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

test('createRecord with directly provided branch', function(assert) {
  answers.push({
    data: {
      id: 1,
      type: 'posts'
    }
  });
  return RSVP.resolve()
    .then(() => {
      let model = this.get('store').createRecord('post');
      return model.save({ adapterOptions: { branch: 'b' } });
    }).then(() => {
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, '/posts?branch=b');
      assert.equal(requests[0].type, 'POST');
    });
});

test('createRecord with branch from resource meta', function(assert) {
  answers.push({
    data: {
      id: 1,
      type: 'posts'
    }
  });
  return RSVP.resolve()
    .then(() => {
      let model = this.get('store').createRecord('post');
      this.get('meta').write(model, { branch: 'b' });
      return model.save();
    }).then(() => {
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, '/posts?branch=b');
      assert.equal(requests[0].type, 'POST');
    });
});

test('updateRecord maintains branch', function(assert) {
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
    .then(() => {
      return this.get('store').findRecord('post', 1, { adapterOptions: { branch: 'b' }});
    }).then(record => record.save())
    .then(() => {
      assert.equal(requests.length, 2);
      assert.equal(requests[1].url, '/posts/1?branch=b');
      assert.equal(requests[1].type, 'PATCH');
    })
});

test('deleteRecord maintains branch', function(assert) {
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
    .then(() => {
      return this.get('store').findRecord('post', 1, { adapterOptions: { branch: 'b' }});
    }).then(record => record.destroyRecord())
    .then(() => {
      assert.equal(requests.length, 2);
      assert.equal(requests[1].url, '/posts/1?branch=b');
      assert.equal(requests[1].type, 'DELETE');
    })
});


test('deleteRecord provides if-match header', function(assert) {
  answers.push({
    data: {
      id: 1,
      type: 'posts',
      meta: {
        version: 'my-version'
      }
    }
  });
  answers.push(null);
  return RSVP.resolve()
    .then(() => {
      return this.get('store').findRecord('post', 1, { adapterOptions: { branch: 'b' }});
    }).then(record => record.destroyRecord())
    .then(() => {
      assert.deepEqual(requests[1].options, {headers: { 'if-match': 'my-version' } });
    })
});
