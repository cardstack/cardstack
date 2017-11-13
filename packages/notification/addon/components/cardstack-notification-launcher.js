import Ember from 'ember';
import Component from "ember-component";
import { task } from 'ember-concurrency';
import inject from 'ember-service/inject';

const { get } = Ember;

export default Component.extend({
  tagName: "",
  cardstackNotifier: inject(),

  manageConnection: task(function * () {
    if (typeof FastBoot !== "undefined") { return; }

    let session = get(this, "session");
    if (session && get(session, "user.id") && get(session, "isAuthenticated")) {
      yield this.get("cardstackNotifier").connect();
    } else {
      yield this.get("cardstackNotifier").disconnect();
    }
  }).observes("session.isAuthenticated").on('init')
});
