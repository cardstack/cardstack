import Ember from "ember";
import { A } from "@ember/array";
import { inject } from '@ember/service';
import { getOwner } from '@ember/application';

export function liveQuery(...args) {
  let query;
  let fn = args.pop();
  let deps = args;
  return Ember.computed(...deps, function(propName) {
    if (query) {
      // we have already run before, we're recomputing due to a dependent key change
      query.cleanup();
    } else {
      // first time
      this.on('willDestroyElement', () => query.cleanup());
    }
    let inputs = fn(...deps.map(d => this.get(d)));
    query = new LiveQuery(inputs, getOwner(this));
    return query.results();
  });
}

class LiveQuery {
  constructor(query, owner) {
    let notifier = owner.lookup('service:cardstack-notifier');
    let store = owner.lookup('service:store');
    this.notifier = notifier;
    this.query = query;

    notifier.subscribe(query);
    // this.queryPromise = store.
  }

  // this should probably be async....
  results() {
    return A();
  }

  cleanup() {
    this.notifier.unsubscribe(this.query);
  }
}
