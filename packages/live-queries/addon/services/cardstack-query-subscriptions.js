import Ember from 'ember';
import Service, { inject } from '@ember/service';

const namespace = 'live-queries';

export default Service.extend({
  socket: inject('cardstack-socket'),
  _idCounter: 0,

  init() {
    this._super(...arguments);
    this._subscriptions = {};
    this._connection = this.get('socket').connect(namespace);
    this._connection.on('query-invalidate', this.invalidate.bind(this));
  },

  subscribe(type, query, invalidate) {
    // Ember Data does stuff with singular types,
    // but the hub works with pluralized types.
    // So, pluralize here before sending over the socket
    type = Ember.String.pluralize(type);

    let subscription_id = this.incrementProperty('_idCounter');
    this._subscriptions[subscription_id] = {
      subscription_id,
      type,
      query,
      invalidate
    };

    this._connection.emit('query-subscribe', subscription_id, type, query);

    return subscription_id;
  },

  unsubscribe(subscription_id) {
    let sub = this._subscriptions[subscription_id];
    if (!sub) {
      Ember.Logger.error(`Unsubscribing non-existant query subscription ${subscription_id}`);
      return;
    }

    sub._deleting = true;
    this._connection.emit('query-unsubscribe', subscription_id, function() {
      delete this._subscriptions[subscription_id];
    });
  },

  invalidate(subscription_id) {
    let sub = this._subscriptions[subscription_id];
    if (!sub) {
      Ember.Logger.warn(`Invalidation received for non-existant query subscription ${subscription_id}`);
    } else if (sub._deleting) {
      Ember.Logger.warn(`Invalidation received for query subscription ${subscription_id} while an unsubscribe is in-flight`);
    } else {
      sub.invalidate();
    }
  }
});
