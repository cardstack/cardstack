import Ember from "ember";
import { liveQuery } from "@cardstack/notification"; //TODO move to @cardstack/live-models
import Component from "@ember/component";
import { inject } from '@ember/service';

const { computed, get } = Ember;

export default Component.extend({
  cardstackSession: inject(),
  userId: computed.readOnly("cardstackSession.user.id"),
  token: computed.readOnly("cardstackSession._rawSession.data.meta.token"),

  logMessages: liveQuery('userId', 'token', function(userId, token) {
    return {
      type: "messages",
      filter: { user_id: userId },
      token
    };
  })
});
