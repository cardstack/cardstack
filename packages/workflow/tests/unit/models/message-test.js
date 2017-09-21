import Ember from 'ember';
import { moduleForModel, test } from 'ember-qunit';
import {
  DELEGATED,
  NEED_RESPONSE,
  PROCESSED,
  FYI,
} from '@cardstack/workflow/models/message';

moduleForModel('message', 'Unit | Model | message', {
  // Specify the other units that are required for this test.
  needs: []
});

test('isImportant', function(assert) {
  let message = this.subject({
    priority: DELEGATED,
    status: 'pending'
  });
  assert.ok(message.get('isImportant'));

  Ember.run(() => {
    message.setProperties({
      priority: NEED_RESPONSE,
      status: 'pending'
    });
  });
  assert.ok(message.get('isImportant'));

  Ember.run(() => {
    message.setProperties({
      priority: NEED_RESPONSE,
      status: 'approved'
    });
  });
  assert.notOk(message.get('isImportant'));

  Ember.run(() => {
    message.setProperties({
      priority: PROCESSED,
      status: 'approved'
    });
  });
  assert.ok(message.get('isImportant'));

  Ember.run(() => {
    message.setProperties({
      priority: PROCESSED,
      status: 'denied'
    });
  });
  assert.ok(message.get('isImportant'));

  Ember.run(() => {
    message.setProperties({
      priority: FYI,
      status: 'denied'
    });
  });
  assert.ok(message.get('isImportant'));
});
