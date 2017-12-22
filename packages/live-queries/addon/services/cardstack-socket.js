import Ember from 'ember';
import Service from '@ember/service';

import io from 'socket-io';
import { host, path } from '@cardstack/live-queries/environment';

// Does this really need to be a service? Looks like it could just be an
// import somewhere. But we may realize we need to manage some state
// later, so it's probably easiest to just always inject it.
export default Service.extend({
  connect(namespace) {
    Ember.Logger.info(`Connecting to socket.io namespace ${namespace} at url: ${host}/${path}`);
    return io(host + '/' + namespace, {
      path
    });
  }
});
