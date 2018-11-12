import Ember from 'ember';
import { getOwner } from '@ember/application';
import { getProperties, computed } from '@ember/object';

export function liveQuery(...args) {
  let query;
  let fn = args.pop();
  let deps = args;
  return computed(...deps, function() {
    if (!this.isComponent) {
      Ember.Logger.warn(
        `Live-query should only be used inside a component due to the lifecycle operations that a component uses. If used outside of a component then you must manually cleanup the live query subscription.`,
      );
    }

    if (query) {
      // we have already run before, we're recomputing due to a dependent key change
      query.cleanup();
    } else {
      // first time
      this.on('willDestroyElement', () => query.cleanup());
    }
    let inputs = fn(getProperties(this, deps));
    query = new LiveQuery(inputs, getOwner(this));
    return query.request;
  });
}

class LiveQuery {
  constructor({ type, query }, owner) {
    if (!query.filter || !query.filter.type) {
      throw new Error(
        "Live query currently requires that you include at least a type filter in your query, e.g. `{ filter: { type: 'items' } }`. (note that hub uses pluralized type names)",
      );
    }
    this.subscriber = owner.lookup('service:cardstack-query-subscriptions');
    this.store = owner.lookup('service:store');

    this.request = this.store.query(type, query);
    this.request.then(recordArray => (this._records = recordArray));

    this.id = this.subscriber.subscribe(query, this.invalidate.bind(this));
  }

  invalidate() {
    if (this._records && !this._records.get('isDestroyed')) {
      this._records.update();
    }
  }

  cleanup() {
    this.subscriber.unsubscribe(this.id);
  }
}
