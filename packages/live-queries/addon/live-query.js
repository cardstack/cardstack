import Ember from "ember";
import { getOwner } from '@ember/application';
import { getProperties } from '@ember/object';

export function liveQuery(...args) {
  let query;
  let fn = args.pop();
  let deps = args;
  return Ember.computed(...deps, function() {
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
  constructor({type, query}, owner) {
    this.subscriber = owner.lookup('service:cardstack-query-subscriptions');
    this.store = owner.lookup('service:store');

    this.request = this.store.query(type, query);
    this.request.then((recordArray) => this._records = recordArray);

    this.id = this.subscriber.subscribe(type, query, this.invalidate.bind(this));
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
