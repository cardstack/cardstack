import { hubURL, defaultBranch } from '@cardstack/plugin-utils/environment';
import fetch from 'fetch';
import Service from '@ember/service';
import { computed } from '@ember/object';
import { getOwner } from '@ember/application';
import { unload } from './-ember-private-api';

export default Service.extend({
  config: computed(function() {
    return getOwner(this).resolveRegistration('config:environment');
  }),
  refreshCode(branch=defaultBranch) {
    let modulePrefix = this.get('config.modulePrefix');
    return fetch(`${hubURL}/codegen/${branch}/${modulePrefix}`)
      .then(response => response.text())
      .then(source => load(source, modulePrefix, getOwner(this)));
  }
});

function load(source, modulePrefix, owner) {
  /* eslint no-unused-vars: 0 */
  function define(moduleName) {
    unload(moduleName, modulePrefix, owner);
    window.define.apply(this, arguments);
  }
  eval(source);
}
